/*
Copyright (C) 2026 JistAI contributors

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

*/

package main

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"errors"
	"flag"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"time"
)

var (
	tarEpoch               = time.Unix(0, 0).UTC()
	zipEpoch               = time.Date(1980, 1, 1, 0, 0, 0, 0, time.UTC)
	requiredLegalArtifacts = []string{
		"LICENSE",
		"NOTICE",
		"THIRD-PARTY-LICENSES.md",
		"VENDORED-SOURCES.json",
		"third_party/licenses/shadcn-ui-MIT.txt",
		"third_party/licenses/vercel-react-best-practices-MIT.txt",
	}
)

type archiveEntry struct {
	archiveName string
	path        string
	info        fs.FileInfo
}

func main() {
	format := flag.String("format", "", "archive format: tar.gz or zip")
	source := flag.String("source", "", "directory to archive")
	output := flag.String("output", "", "archive output path")
	flag.Parse()

	if err := packageRelease(*format, *source, *output); err != nil {
		fmt.Fprintf(os.Stderr, "release packager: %v\n", err)
		os.Exit(1)
	}
}

func packageRelease(format, source, output string) error {
	if source == "" || output == "" {
		return errors.New("source and output are required")
	}
	if err := validateLegalArtifacts(source); err != nil {
		return err
	}

	entries, err := collectEntries(source)
	if err != nil {
		return err
	}

	out, err := os.OpenFile(output, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return fmt.Errorf("create output: %w", err)
	}
	complete := false
	defer func() {
		if !complete {
			_ = os.Remove(output)
		}
	}()

	switch format {
	case "tar.gz":
		err = writeTarGz(out, entries)
	case "zip":
		err = writeZip(out, entries)
	default:
		err = fmt.Errorf("unsupported format %q", format)
	}
	if closeErr := out.Close(); err == nil {
		err = closeErr
	}
	if err != nil {
		return err
	}

	complete = true
	return nil
}

func validateLegalArtifacts(source string) error {
	root, err := filepath.Abs(source)
	if err != nil {
		return fmt.Errorf("resolve source: %w", err)
	}
	rootInfo, err := os.Lstat(root)
	if err != nil {
		return fmt.Errorf("stat source: %w", err)
	}
	if !rootInfo.IsDir() {
		return errors.New("source must be a directory")
	}

	for _, name := range requiredLegalArtifacts {
		artifactPath := filepath.Join(root, filepath.FromSlash(name))
		info, statErr := os.Lstat(artifactPath)
		if statErr != nil {
			if errors.Is(statErr, os.ErrNotExist) {
				return fmt.Errorf("required legal artifact is missing: %s", name)
			}
			return fmt.Errorf("stat required legal artifact %s: %w", name, statErr)
		}
		if info.Mode()&os.ModeSymlink != 0 || !info.Mode().IsRegular() {
			return fmt.Errorf("required legal artifact must be a regular file: %s", name)
		}
		if info.Size() == 0 {
			return fmt.Errorf("required legal artifact must not be empty: %s", name)
		}
	}
	return nil
}

func collectEntries(source string) ([]archiveEntry, error) {
	root, err := filepath.Abs(source)
	if err != nil {
		return nil, fmt.Errorf("resolve source: %w", err)
	}
	rootInfo, err := os.Lstat(root)
	if err != nil {
		return nil, fmt.Errorf("stat source: %w", err)
	}
	if !rootInfo.IsDir() {
		return nil, errors.New("source must be a directory")
	}

	rootName := filepath.Base(root)
	entries := []archiveEntry{{archiveName: rootName + "/", path: root, info: rootInfo}}
	err = filepath.WalkDir(root, func(current string, entry fs.DirEntry, walkErr error) error {
		if walkErr != nil {
			return walkErr
		}
		if current == root {
			return nil
		}
		if entry.Type()&os.ModeSymlink != 0 {
			return fmt.Errorf("symbolic links are not supported: %s", current)
		}
		info, infoErr := entry.Info()
		if infoErr != nil {
			return infoErr
		}
		if !info.IsDir() && !info.Mode().IsRegular() {
			return fmt.Errorf("unsupported file type: %s", current)
		}
		relative, relErr := filepath.Rel(root, current)
		if relErr != nil {
			return relErr
		}
		name := filepath.ToSlash(filepath.Join(rootName, relative))
		if info.IsDir() {
			name += "/"
		}
		entries = append(entries, archiveEntry{archiveName: name, path: current, info: info})
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("walk source: %w", err)
	}
	return entries, nil
}

func normalizedMode(info fs.FileInfo) fs.FileMode {
	if info.IsDir() || info.Mode().Perm()&0o111 != 0 {
		return 0o755
	}
	return 0o644
}

func writeTarGz(output io.Writer, entries []archiveEntry) error {
	gzipWriter, err := gzip.NewWriterLevel(output, gzip.BestCompression)
	if err != nil {
		return fmt.Errorf("create gzip writer: %w", err)
	}
	gzipWriter.Header.ModTime = tarEpoch
	gzipWriter.Header.OS = 255

	tarWriter := tar.NewWriter(gzipWriter)
	for _, entry := range entries {
		header, headerErr := tar.FileInfoHeader(entry.info, "")
		if headerErr != nil {
			return headerErr
		}
		header.Name = entry.archiveName
		header.Mode = int64(normalizedMode(entry.info).Perm())
		header.ModTime = tarEpoch
		header.AccessTime = time.Time{}
		header.ChangeTime = time.Time{}
		header.Uid = 0
		header.Gid = 0
		header.Uname = "root"
		header.Gname = "root"
		header.Format = tar.FormatUSTAR
		if err = tarWriter.WriteHeader(header); err != nil {
			return fmt.Errorf("write tar header %s: %w", entry.archiveName, err)
		}
		if entry.info.Mode().IsRegular() {
			if err = copyFile(tarWriter, entry.path); err != nil {
				return err
			}
		}
	}
	if err = tarWriter.Close(); err != nil {
		return fmt.Errorf("close tar writer: %w", err)
	}
	if err = gzipWriter.Close(); err != nil {
		return fmt.Errorf("close gzip writer: %w", err)
	}
	return nil
}

func writeZip(output io.Writer, entries []archiveEntry) error {
	zipWriter := zip.NewWriter(output)
	for _, entry := range entries {
		header := &zip.FileHeader{Name: entry.archiveName}
		header.SetModTime(zipEpoch)
		header.SetMode(normalizedMode(entry.info))
		if entry.info.IsDir() {
			header.Method = zip.Store
		} else {
			header.Method = zip.Deflate
		}
		writer, err := zipWriter.CreateHeader(header)
		if err != nil {
			return fmt.Errorf("write zip header %s: %w", entry.archiveName, err)
		}
		if entry.info.Mode().IsRegular() {
			if err = copyFile(writer, entry.path); err != nil {
				return err
			}
		}
	}
	if err := zipWriter.Close(); err != nil {
		return fmt.Errorf("close zip writer: %w", err)
	}
	return nil
}

func copyFile(destination io.Writer, source string) error {
	file, err := os.Open(source)
	if err != nil {
		return fmt.Errorf("open %s: %w", source, err)
	}
	defer file.Close()
	if _, err = io.Copy(destination, file); err != nil {
		return fmt.Errorf("copy %s: %w", source, err)
	}
	return nil
}

func archiveNames(entries []archiveEntry) string {
	names := make([]string, len(entries))
	for index, entry := range entries {
		names[index] = entry.archiveName
	}
	return strings.Join(names, "\n")
}
