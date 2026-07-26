/*
Copyright (C) 2026 JistAI contributors
SPDX-License-Identifier: AGPL-3.0-or-later
*/

package main

import (
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
)

type editResult struct {
	Require []struct {
		Path     string
		Version  string
		Indirect bool
	}
}

type downloadResult struct {
	Path     string
	Version  string
	Dir      string
	GoMod    string
	Sum      string
	GoModSum string
	Error    string
}

type fileHash struct {
	Bytes  int    `json:"bytes"`
	SHA256 string `json:"sha256"`
}

type evidence struct {
	Name           string `json:"name"`
	Kind           string `json:"kind"`
	Bytes          int    `json:"bytes"`
	SHA256         string `json:"sha256"`
	Classification string `json:"classification"`
	ContentBase64  string `json:"contentBase64"`
}

type moduleRecord struct {
	Path     string     `json:"path"`
	Version  string     `json:"version"`
	Indirect bool       `json:"indirect"`
	Sum      string     `json:"sum"`
	GoModSum string     `json:"goModSum"`
	GoMod    fileHash   `json:"goMod"`
	Evidence []evidence `json:"evidence"`
	Error    string     `json:"error,omitempty"`
}

func digest(content []byte) fileHash {
	hash := sha256.Sum256(content)
	return fileHash{Bytes: len(content), SHA256: hex.EncodeToString(hash[:])}
}

func digestFile(path string) fileHash {
	content, err := os.ReadFile(path)
	if err != nil {
		panic(err)
	}
	return digest(content)
}

func run(name string, arguments ...string) []byte {
	command := exec.Command(name, arguments...)
	output, err := command.Output()
	if err != nil {
		fmt.Fprintf(os.Stderr, "%s %s: %v\n", name, strings.Join(arguments, " "), err)
		os.Exit(1)
	}
	return output
}

func classify(content []byte) string {
	text := strings.ToLower(string(content))
	switch {
	case strings.Contains(text, "apache license") && strings.Contains(text, "version 2.0"):
		return "Apache-2.0"
	case strings.Contains(text, "mozilla public license") && strings.Contains(text, "version 2.0"):
		return "MPL-2.0"
	case strings.Contains(text, "permission is hereby granted, free of charge"):
		return "MIT"
	case strings.Contains(text, "redistribution and use in source and binary forms") && strings.Contains(text, "neither the name"):
		return "BSD-3-Clause-like"
	case strings.Contains(text, "redistribution and use in source and binary forms"):
		return "BSD-like"
	case strings.Contains(text, "permission to use, copy, modify, and/or distribute this software"):
		return "ISC"
	case strings.Contains(text, "free and unencumbered software released into the public domain"):
		return "Unlicense"
	case strings.Contains(text, "sil open font license"):
		return "OFL-1.1"
	case strings.Contains(text, "creative commons zero"):
		return "CC0-1.0"
	default:
		return "unclassified"
	}
}

func evidenceKind(name string) string {
	upper := strings.ToUpper(name)
	switch {
	case strings.HasPrefix(upper, "NOTICE"):
		return "notice"
	case strings.HasPrefix(upper, "PATENTS"):
		return "patents"
	case strings.HasPrefix(upper, "COPYRIGHT"):
		return "copyright"
	default:
		return "license"
	}
}

func main() {
	output := flag.String("output", "", "output JSON path")
	flag.Parse()
	if *output == "" {
		fmt.Fprintln(os.Stderr, "usage: go run license-final-go-scan.go -output PATH")
		os.Exit(2)
	}

	var edit editResult
	if err := json.Unmarshal(run("go", "mod", "edit", "-json"), &edit); err != nil {
		panic(err)
	}
	requirements := make(map[string]bool, len(edit.Require))
	for _, dependency := range edit.Require {
		requirements[dependency.Path+"@"+dependency.Version] = dependency.Indirect
	}

	command := exec.Command("go", "mod", "download", "-json")
	stdout, err := command.StdoutPipe()
	if err != nil {
		panic(err)
	}
	if err := command.Start(); err != nil {
		panic(err)
	}
	decoder := json.NewDecoder(stdout)
	modules := make([]moduleRecord, 0, len(edit.Require))
	for {
		var downloaded downloadResult
		err := decoder.Decode(&downloaded)
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			panic(err)
		}
		record := moduleRecord{
			Path: downloaded.Path, Version: downloaded.Version,
			Indirect: requirements[downloaded.Path+"@"+downloaded.Version],
			Sum:      downloaded.Sum, GoModSum: downloaded.GoModSum, Error: downloaded.Error,
		}
		if downloaded.GoMod != "" {
			if content, readErr := os.ReadFile(downloaded.GoMod); readErr == nil {
				record.GoMod = digest(content)
			}
		}
		entries, readErr := os.ReadDir(downloaded.Dir)
		if readErr == nil {
			for _, entry := range entries {
				if entry.IsDir() {
					continue
				}
				upper := strings.ToUpper(entry.Name())
				if !(strings.HasPrefix(upper, "LICENSE") || strings.HasPrefix(upper, "LICENCE") || strings.HasPrefix(upper, "UNLICENSE") || strings.HasPrefix(upper, "COPYING") || strings.HasPrefix(upper, "NOTICE") || strings.HasPrefix(upper, "PATENTS") || strings.HasPrefix(upper, "COPYRIGHT")) {
					continue
				}
				content, fileErr := os.ReadFile(filepath.Join(downloaded.Dir, entry.Name()))
				if fileErr != nil {
					continue
				}
				fileDigest := digest(content)
				record.Evidence = append(record.Evidence, evidence{
					Name: entry.Name(), Kind: evidenceKind(entry.Name()), Bytes: fileDigest.Bytes,
					SHA256: fileDigest.SHA256, Classification: classify(content),
					ContentBase64: base64.StdEncoding.EncodeToString(content),
				})
			}
		}
		sort.Slice(record.Evidence, func(left, right int) bool {
			return record.Evidence[left].Name < record.Evidence[right].Name
		})
		modules = append(modules, record)
	}
	if err := command.Wait(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
	sort.Slice(modules, func(left, right int) bool {
		return modules[left].Path+"@"+modules[left].Version < modules[right].Path+"@"+modules[right].Version
	})

	withoutEvidence := make([]string, 0)
	unclassified := make([]string, 0)
	for _, module := range modules {
		hasClassifiedLicense := false
		hasUnclassifiedLicense := false
		for _, file := range module.Evidence {
			if file.Kind != "license" {
				continue
			}
			if file.Classification == "unclassified" {
				hasUnclassifiedLicense = true
			} else {
				hasClassifiedLicense = true
			}
		}
		key := module.Path + "@" + module.Version
		if !hasClassifiedLicense {
			withoutEvidence = append(withoutEvidence, key)
		}
		if hasUnclassifiedLicense && !hasClassifiedLicense {
			unclassified = append(unclassified, key)
		}
	}

	report := struct {
		SchemaVersion    int            `json:"schemaVersion"`
		GoMod            fileHash       `json:"goMod"`
		GoSum            fileHash       `json:"goSum"`
		RequirementCount int            `json:"requirementCount"`
		DownloadedCount  int            `json:"downloadedCount"`
		WithoutEvidence  []string       `json:"withoutEvidence"`
		Unclassified     []string       `json:"unclassified"`
		Modules          []moduleRecord `json:"modules"`
	}{
		SchemaVersion: 1, GoMod: digestFile("go.mod"), GoSum: digestFile("go.sum"),
		RequirementCount: len(edit.Require), DownloadedCount: len(modules),
		WithoutEvidence: withoutEvidence, Unclassified: unclassified, Modules: modules,
	}
	encoded, err := json.MarshalIndent(report, "", "  ")
	if err != nil {
		panic(err)
	}
	encoded = append(encoded, '\n')
	if err := os.MkdirAll(filepath.Dir(*output), 0o755); err != nil {
		panic(err)
	}
	if err := os.WriteFile(*output, encoded, 0o644); err != nil {
		panic(err)
	}
	fmt.Printf("{\"output\":%q,\"outputSha256\":%q,\"requirementCount\":%d,\"downloadedCount\":%d,\"withoutEvidenceCount\":%d,\"unclassifiedCount\":%d}\n",
		*output, digest(encoded).SHA256, len(edit.Require), len(modules), len(withoutEvidence), len(unclassified))
}
