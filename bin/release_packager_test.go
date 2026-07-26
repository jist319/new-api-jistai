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
	"bytes"
	"compress/gzip"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func writeRequiredLegalArtifacts(t *testing.T, root string) {
	t.Helper()
	for _, name := range requiredLegalArtifacts {
		path := filepath.Join(root, filepath.FromSlash(name))
		if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(name+"\n"), 0o644); err != nil {
			t.Fatal(err)
		}
	}
}

func readArchiveFiles(t *testing.T, archivePath, format string) map[string][]byte {
	t.Helper()
	files := make(map[string][]byte)

	switch format {
	case "tar.gz":
		file, err := os.Open(archivePath)
		if err != nil {
			t.Fatal(err)
		}
		defer file.Close()
		gzipReader, err := gzip.NewReader(file)
		if err != nil {
			t.Fatal(err)
		}
		defer gzipReader.Close()
		tarReader := tar.NewReader(gzipReader)
		for {
			header, nextErr := tarReader.Next()
			if nextErr == io.EOF {
				break
			}
			if nextErr != nil {
				t.Fatal(nextErr)
			}
			if header.FileInfo().Mode().IsRegular() {
				content, readErr := io.ReadAll(tarReader)
				if readErr != nil {
					t.Fatal(readErr)
				}
				files[header.Name] = content
			}
		}
	case "zip":
		reader, err := zip.OpenReader(archivePath)
		if err != nil {
			t.Fatal(err)
		}
		defer reader.Close()
		for _, entry := range reader.File {
			if !entry.Mode().IsRegular() {
				continue
			}
			file, openErr := entry.Open()
			if openErr != nil {
				t.Fatal(openErr)
			}
			content, readErr := io.ReadAll(file)
			closeErr := file.Close()
			if readErr != nil {
				t.Fatal(readErr)
			}
			if closeErr != nil {
				t.Fatal(closeErr)
			}
			files[entry.Name] = content
		}
	default:
		t.Fatalf("unsupported test archive format %q", format)
	}

	return files
}

func TestPackageReleaseIsDeterministic(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "new-api-test")
	if err := os.Mkdir(source, 0o755); err != nil {
		t.Fatal(err)
	}
	writeRequiredLegalArtifacts(t, source)
	if err := os.WriteFile(filepath.Join(source, "new-api"), []byte("binary\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	for _, format := range []string{"tar.gz", "zip"} {
		t.Run(format, func(t *testing.T) {
			first := filepath.Join(root, "first."+format)
			second := filepath.Join(root, "second."+format)
			if err := packageRelease(format, source, first); err != nil {
				t.Fatal(err)
			}
			if err := packageRelease(format, source, second); err != nil {
				t.Fatal(err)
			}
			firstBytes, err := os.ReadFile(first)
			if err != nil {
				t.Fatal(err)
			}
			secondBytes, err := os.ReadFile(second)
			if err != nil {
				t.Fatal(err)
			}
			if !bytes.Equal(firstBytes, secondBytes) {
				t.Fatalf("%s output changed between identical runs", format)
			}

			archiveFiles := readArchiveFiles(t, first, format)
			rootName := filepath.Base(source)
			for _, name := range requiredLegalArtifacts {
				archiveName := filepath.ToSlash(filepath.Join(rootName, filepath.FromSlash(name)))
				want := []byte(name + "\n")
				if got, ok := archiveFiles[archiveName]; !ok {
					t.Errorf("%s archive is missing %s", format, archiveName)
				} else if !bytes.Equal(got, want) {
					t.Errorf("%s archive changed bytes for %s", format, archiveName)
				}
			}
		})
	}
}

func TestCollectEntriesUsesStableArchiveNames(t *testing.T) {
	root := filepath.Join(t.TempDir(), "package")
	if err := os.MkdirAll(filepath.Join(root, "licenses"), 0o755); err != nil {
		t.Fatal(err)
	}
	writeRequiredLegalArtifacts(t, root)
	if err := os.WriteFile(filepath.Join(root, "licenses", "NOTICE"), []byte("nested notice\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	entries, err := collectEntries(root)
	if err != nil {
		t.Fatal(err)
	}
	want := strings.Join([]string{
		"package/",
		"package/LICENSE",
		"package/NOTICE",
		"package/THIRD-PARTY-LICENSES.md",
		"package/VENDORED-SOURCES.json",
		"package/licenses/",
		"package/licenses/NOTICE",
		"package/third_party/",
		"package/third_party/licenses/",
		"package/third_party/licenses/shadcn-ui-MIT.txt",
		"package/third_party/licenses/vercel-react-best-practices-MIT.txt",
	}, "\n")
	if got := archiveNames(entries); got != want {
		t.Fatalf("unexpected archive names:\n%s", got)
	}
}

func TestPackageReleaseRejectsMissingLegalArtifact(t *testing.T) {
	for _, missing := range requiredLegalArtifacts {
		t.Run(missing, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "package")
			if err := os.MkdirAll(root, 0o755); err != nil {
				t.Fatal(err)
			}
			writeRequiredLegalArtifacts(t, root)
			if err := os.Remove(filepath.Join(root, filepath.FromSlash(missing))); err != nil {
				t.Fatal(err)
			}
			output := filepath.Join(t.TempDir(), "release.tar.gz")
			err := packageRelease("tar.gz", root, output)
			if err == nil || !strings.Contains(err.Error(), missing) {
				t.Fatalf("expected missing %s error, got %v", missing, err)
			}
			if _, statErr := os.Stat(output); !os.IsNotExist(statErr) {
				t.Fatalf("output exists after failed preflight: %v", statErr)
			}
		})
	}
}

func TestPackageReleaseRejectsInvalidLegalArtifact(t *testing.T) {
	tests := []struct {
		name   string
		mutate func(t *testing.T, artifactPath string)
	}{
		{
			name: "empty",
			mutate: func(t *testing.T, artifactPath string) {
				t.Helper()
				if err := os.WriteFile(artifactPath, nil, 0o644); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "directory",
			mutate: func(t *testing.T, artifactPath string) {
				t.Helper()
				if err := os.Remove(artifactPath); err != nil {
					t.Fatal(err)
				}
				if err := os.Mkdir(artifactPath, 0o755); err != nil {
					t.Fatal(err)
				}
			},
		},
		{
			name: "symbolic-link",
			mutate: func(t *testing.T, artifactPath string) {
				t.Helper()
				if err := os.Remove(artifactPath); err != nil {
					t.Fatal(err)
				}
				if err := os.Symlink("LICENSE", artifactPath); err != nil {
					t.Skipf("symbolic links are unavailable: %v", err)
				}
			},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			root := filepath.Join(t.TempDir(), "package")
			if err := os.MkdirAll(root, 0o755); err != nil {
				t.Fatal(err)
			}
			writeRequiredLegalArtifacts(t, root)
			test.mutate(t, filepath.Join(root, "NOTICE"))
			output := filepath.Join(t.TempDir(), "release.tar.gz")
			err := packageRelease("tar.gz", root, output)
			if err == nil || !strings.Contains(err.Error(), "NOTICE") {
				t.Fatalf("expected invalid NOTICE error, got %v", err)
			}
			if _, statErr := os.Stat(output); !os.IsNotExist(statErr) {
				t.Fatalf("output exists after failed preflight: %v", statErr)
			}
		})
	}
}

func TestPackageReleaseRejectsSymbolicLinkSource(t *testing.T) {
	realSource := filepath.Join(t.TempDir(), "real-package")
	if err := os.MkdirAll(realSource, 0o755); err != nil {
		t.Fatal(err)
	}
	writeRequiredLegalArtifacts(t, realSource)
	if err := os.WriteFile(filepath.Join(realSource, "new-api"), []byte("binary\n"), 0o755); err != nil {
		t.Fatal(err)
	}

	symlinkSource := filepath.Join(t.TempDir(), "source")
	if err := os.Symlink(realSource, symlinkSource); err != nil {
		t.Skipf("symbolic links are unavailable: %v", err)
	}
	output := filepath.Join(t.TempDir(), "release.tar.gz")
	err := packageRelease("tar.gz", symlinkSource, output)
	if err == nil || !strings.Contains(err.Error(), "source must be a directory") {
		t.Fatalf("expected symbolic-link source error, got %v", err)
	}
	if _, statErr := os.Stat(output); !os.IsNotExist(statErr) {
		t.Fatalf("output exists after failed source preflight: %v", statErr)
	}
}
