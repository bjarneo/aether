package platform

import (
	"encoding/json"
	"io"
	"os"
	"path/filepath"
)

// ReadJSON reads and unmarshals a JSON file into T.
func ReadJSON[T any](path string) (T, error) {
	var v T
	data, err := os.ReadFile(path)
	if err != nil {
		return v, err
	}
	if err := json.Unmarshal(data, &v); err != nil {
		return v, err
	}
	return v, nil
}

// WriteJSON marshals v as indented JSON and writes it to path, creating parent
// directories as needed.
func WriteJSON[T any](path string, v T) error {
	if err := EnsureDir(filepath.Dir(path)); err != nil {
		return err
	}
	data, err := json.MarshalIndent(v, "", "  ")
	if err != nil {
		return err
	}
	data = append(data, '\n')
	return os.WriteFile(path, data, 0644)
}

// ReadText reads a file and returns its contents as a string.
func ReadText(path string) (string, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return "", err
	}
	return string(data), nil
}

// WriteText writes content to path with 0644 permissions, creating parent
// directories as needed.
func WriteText(path string, content string) error {
	if err := EnsureDir(filepath.Dir(path)); err != nil {
		return err
	}
	return os.WriteFile(path, []byte(content), 0644)
}

// CopyFile copies src to dst, preserving the source file's permissions.
func CopyFile(src, dst string) error {
	srcFile, err := os.Open(src)
	if err != nil {
		return err
	}
	defer srcFile.Close()

	info, err := srcFile.Stat()
	if err != nil {
		return err
	}

	if err := EnsureDir(filepath.Dir(dst)); err != nil {
		return err
	}

	dstFile, err := os.OpenFile(dst, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, info.Mode())
	if err != nil {
		return err
	}
	defer dstFile.Close()

	_, err = io.Copy(dstFile, srcFile)
	return err
}

// EnsureDir creates the directory at path along with any necessary parents
// (equivalent to mkdir -p).
func EnsureDir(path string) error {
	return os.MkdirAll(path, 0755)
}

// CleanDir removes all files in directory at path but leaves subdirectories
// intact. Returns nil if the directory does not exist.
func CleanDir(path string) error {
	entries, err := os.ReadDir(path)
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		if err := os.Remove(filepath.Join(path, e.Name())); err != nil {
			return err
		}
	}
	return nil
}

// FileExists reports whether the file at path exists and is not a directory.
func FileExists(path string) bool {
	info, err := os.Stat(path)
	if err != nil {
		return false
	}
	return !info.IsDir()
}

// CreateSymlink creates a symbolic link at link pointing to target. If link
// already exists it is removed first.
func CreateSymlink(target, link string) error {
	if err := EnsureDir(filepath.Dir(link)); err != nil {
		return err
	}
	// Remove existing link (or file) if present; ignore error if it doesn't exist.
	_ = os.Remove(link)
	return os.Symlink(target, link)
}

// DeleteFile removes the file at path. Returns nil if the file does not exist.
func DeleteFile(path string) error {
	err := os.Remove(path)
	if os.IsNotExist(err) {
		return nil
	}
	return err
}
