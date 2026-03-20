package extraction

import (
	"crypto/md5"
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"time"
)

// cacheData represents the JSON structure stored in cache files.
type cacheData struct {
	Palette   [16]string `json:"palette"`
	Timestamp int64      `json:"timestamp"`
	Version   int        `json:"version"`
}

// getCacheDir returns the cache directory for color extraction results.
func getCacheDir() string {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = os.Getenv("HOME")
	}
	return filepath.Join(homeDir, ".cache", "aether", "color-cache")
}

// GetCacheKey generates a cache key based on image path, modification time, and light mode.
// Returns an empty string if the key cannot be generated.
func GetCacheKey(imagePath string, lightMode bool) string {
	info, err := os.Stat(imagePath)
	if err != nil {
		return ""
	}

	modeStr := "dark"
	if lightMode {
		modeStr = "light"
	}

	mtimeSeconds := info.ModTime().Unix()
	dataString := fmt.Sprintf("%s-%d-%s", imagePath, mtimeSeconds, modeStr)

	hash := md5.Sum([]byte(dataString))
	return fmt.Sprintf("%x", hash)
}

// LoadCachedPalette loads a cached color palette if available.
// Returns the palette and true if found, or a zero palette and false otherwise.
func LoadCachedPalette(cacheKey string) ([16]string, bool) {
	cacheDir := getCacheDir()
	cachePath := filepath.Join(cacheDir, cacheKey+".json")

	content, err := os.ReadFile(cachePath)
	if err != nil {
		return [16]string{}, false
	}

	var data cacheData
	if err := json.Unmarshal(content, &data); err != nil {
		return [16]string{}, false
	}

	// Validate that we got a complete palette
	for _, c := range data.Palette {
		if c == "" {
			return [16]string{}, false
		}
	}

	return data.Palette, true
}

// SavePaletteToCache saves a color palette to the cache.
func SavePaletteToCache(cacheKey string, palette [16]string) {
	cacheDir := getCacheDir()

	if err := os.MkdirAll(cacheDir, 0755); err != nil {
		return
	}

	cachePath := filepath.Join(cacheDir, cacheKey+".json")
	data := cacheData{
		Palette:   palette,
		Timestamp: time.Now().UnixMilli(),
		Version:   CacheVersion,
	}

	content, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return
	}

	_ = os.WriteFile(cachePath, content, 0644)
}
