package wallpaper

import (
	"os"
	"path/filepath"
	"strings"

	"aether/internal/platform"
)

// WallpaperInfo describes a local wallpaper image file.
type WallpaperInfo struct {
	Path    string `json:"path"`
	Name    string `json:"name"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"modTime"`
}

var imageExtensions = map[string]bool{
	".jpg":  true,
	".jpeg": true,
	".png":  true,
	".gif":  true,
	".webp": true,
	".bmp":  true,
}

// ScanDirectory scans a directory for image files and returns their info.
// Only the immediate directory is scanned (no recursion).
func ScanDirectory(dir string) ([]WallpaperInfo, error) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return nil, err
	}

	var results []WallpaperInfo
	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		ext := strings.ToLower(filepath.Ext(entry.Name()))
		if !imageExtensions[ext] {
			continue
		}

		info, err := entry.Info()
		if err != nil {
			continue
		}

		results = append(results, WallpaperInfo{
			Path:    filepath.Join(dir, entry.Name()),
			Name:    entry.Name(),
			Size:    info.Size(),
			ModTime: info.ModTime().Unix(),
		})
	}

	return results, nil
}

// ScanDefaultDirs scans ~/Wallpapers for wallpaper images.
func ScanDefaultDirs() ([]WallpaperInfo, error) {
	dir := platform.WallpaperDir()
	if _, err := os.Stat(dir); os.IsNotExist(err) {
		return nil, nil
	}
	return ScanDirectory(dir)
}
