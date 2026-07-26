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
	"bytes"
	"os"
	"path/filepath"
	"testing"
)

func TestPackageReleaseIsDeterministic(t *testing.T) {
	root := t.TempDir()
	source := filepath.Join(root, "new-api-test")
	if err := os.Mkdir(source, 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(source, "LICENSE"), []byte("license\n"), 0o644); err != nil {
		t.Fatal(err)
	}
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
		})
	}
}

func TestCollectEntriesUsesStableArchiveNames(t *testing.T) {
	root := filepath.Join(t.TempDir(), "package")
	if err := os.MkdirAll(filepath.Join(root, "licenses"), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(filepath.Join(root, "licenses", "NOTICE"), []byte("notice\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	entries, err := collectEntries(root)
	if err != nil {
		t.Fatal(err)
	}
	want := "package/\npackage/licenses/\npackage/licenses/NOTICE"
	if got := archiveNames(entries); got != want {
		t.Fatalf("unexpected archive names:\n%s", got)
	}
}
