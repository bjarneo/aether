package wallpaper

import (
	"io/fs"
	"path/filepath"
	"strings"

	"aether/internal/platform"
	"aether/internal/theme"
)

// WallpaperInfo describes a local wallpaper image file.
type WallpaperInfo struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"`
}

// ScanDirectory recursively scans a directory tree for image and video files.
// Hidden directories (names starting with ".") and symlinked directories are
// skipped. Files in subfolders are returned with a relative path as Name so
// the UI can disambiguate files that share a basename across folders.
func ScanDirectory(dir string) ([]WallpaperInfo, error) {
	root, err := filepath.Abs(dir)
	if err != nil {
		root = dir
	}

	var results []WallpaperInfo
	walkErr := filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			// Ignore unreadable entries; keep walking the rest of the tree.
			if d != nil && d.IsDir() {
				return fs.SkipDir
			}
			return nil
		}

		if d.IsDir() {
			if path != root && strings.HasPrefix(d.Name(), ".") {
				return fs.SkipDir
			}
			return nil
		}

		if !theme.IsImageFile(path) && !theme.IsVideoFile(path) {
			return nil
		}

		info, err := d.Info()
		if err != nil {
			return nil
		}

		name := d.Name()
		if rel, err := filepath.Rel(root, path); err == nil && rel != "." && !strings.HasPrefix(rel, "..") {
			name = rel
		}

		results = append(results, WallpaperInfo{
			Path:    path,
			Name:    name,
			Size:    info.Size(),
			ModTime: info.ModTime().Unix(),
		})
		return nil
	})
	if walkErr != nil {
		return nil, walkErr
	}

	return results, nil
}

// ScanDefaultDirs scans ~/Wallpapers (recursively), creating it if missing.
func ScanDefaultDirs() ([]WallpaperInfo, error) {
	dir := platform.WallpaperDir()
	if err := platform.EnsureDir(dir); err != nil {
		return nil, err
	}
	return ScanDirectory(dir)
}
