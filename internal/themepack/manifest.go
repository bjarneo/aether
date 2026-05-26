package themepack

import (
	"fmt"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"aether/internal/blueprint"
	"aether/internal/platform"
)

const (
	Format        = "aether-theme-pack"
	Version       = 1
	ManifestFile  = "aether-theme-pack.json"
	BlueprintFile = "blueprint.json"
)

// Manifest describes a portable Aether theme pack directory.
type Manifest struct {
	Format           string   `json:"format"`
	Version          int      `json:"version"`
	Name             string   `json:"name"`
	Slug             string   `json:"slug"`
	CreatedAt        string   `json:"createdAt"`
	Apps             []string `json:"apps"`
	LightMode        bool     `json:"lightMode"`
	Wallpaper        string   `json:"wallpaper,omitempty"`
	AdditionalImages []string `json:"additionalImages,omitempty"`
	Blueprint        string   `json:"blueprint"`
	Files            []string `json:"files"`
}

// NewManifest builds a pack manifest from generated files under dir.
func NewManifest(dir, name, slug string, apps []string, lightMode bool, wallpaper string, images []string) (Manifest, error) {
	files, err := listPackFiles(dir)
	if err != nil {
		return Manifest{}, err
	}
	sort.Strings(apps)
	return Manifest{
		Format:           Format,
		Version:          Version,
		Name:             name,
		Slug:             slug,
		CreatedAt:        time.Now().UTC().Format(time.RFC3339),
		Apps:             apps,
		LightMode:        lightMode,
		Wallpaper:        cleanRelative(wallpaper),
		AdditionalImages: cleanRelativeSlice(images),
		Blueprint:        BlueprintFile,
		Files:            files,
	}, nil
}

// Write stores the manifest and bundled blueprint in dir.
func Write(dir string, manifest Manifest, bp *blueprint.Blueprint) error {
	if err := platform.WriteJSON(filepath.Join(dir, BlueprintFile), bp); err != nil {
		return err
	}
	manifest.Files = appendMissing(manifest.Files, BlueprintFile)
	manifest.Files = appendMissing(manifest.Files, ManifestFile)
	sort.Strings(manifest.Files)
	return platform.WriteJSON(filepath.Join(dir, ManifestFile), manifest)
}

// Import reads a theme pack directory, manifest, or bundled blueprint file.
func Import(path string) (*blueprint.Blueprint, error) {
	dir, manifestPath, err := resolveInput(path)
	if err != nil {
		return nil, err
	}

	manifest := Manifest{Blueprint: BlueprintFile}
	if manifestPath != "" {
		if m, err := platform.ReadJSON[Manifest](manifestPath); err == nil {
			manifest = m
		}
	}

	blueprintPath := filepath.Join(dir, manifest.Blueprint)
	if manifest.Blueprint == "" {
		blueprintPath = filepath.Join(dir, BlueprintFile)
	}
	bp, err := blueprint.ImportJSON(blueprintPath)
	if err != nil {
		return nil, err
	}
	if bp.Name == "" && manifest.Name != "" {
		bp.Name = manifest.Name
	}

	bp.Palette.Wallpaper = resolvePackPath(dir, bp.Palette.Wallpaper)
	for i, p := range bp.Palette.AdditionalImages {
		bp.Palette.AdditionalImages[i] = resolvePackPath(dir, p)
	}
	return bp, nil
}

func resolveInput(input string) (dir string, manifestPath string, err error) {
	info, err := os.Stat(input)
	if err != nil {
		return "", "", err
	}
	if info.IsDir() {
		dir = input
	} else {
		dir = filepath.Dir(input)
		switch filepath.Base(input) {
		case ManifestFile:
			manifestPath = input
		case BlueprintFile:
			manifestPath = filepath.Join(dir, ManifestFile)
		default:
			return "", "", fmt.Errorf("not an Aether theme pack file: %s", input)
		}
	}
	if manifestPath == "" {
		candidate := filepath.Join(dir, ManifestFile)
		if platform.FileExists(candidate) {
			manifestPath = candidate
		}
	}
	return dir, manifestPath, nil
}

func resolvePackPath(dir, p string) string {
	if p == "" || filepath.IsAbs(p) || strings.HasPrefix(p, "http://") || strings.HasPrefix(p, "https://") {
		return p
	}
	return filepath.Join(dir, filepath.FromSlash(p))
}

func listPackFiles(root string) ([]string, error) {
	var files []string
	err := filepath.WalkDir(root, func(p string, d os.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		rel, err := filepath.Rel(root, p)
		if err != nil {
			return err
		}
		files = append(files, filepath.ToSlash(rel))
		return nil
	})
	return files, err
}

func cleanRelative(p string) string {
	if p == "" {
		return ""
	}
	return filepath.ToSlash(p)
}

func cleanRelativeSlice(paths []string) []string {
	out := make([]string, 0, len(paths))
	for _, p := range paths {
		if p != "" {
			out = append(out, cleanRelative(p))
		}
	}
	return out
}

func appendMissing(items []string, item string) []string {
	for _, existing := range items {
		if existing == item {
			return items
		}
	}
	return append(items, item)
}
