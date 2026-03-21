package blueprint

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aether/internal/omarchy"
	"aether/internal/platform"
)

// ImportJSON imports a blueprint from a local JSON file.
func ImportJSON(filePath string) (*Blueprint, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	var bp Blueprint
	if err := json.Unmarshal(data, &bp); err != nil {
		return nil, fmt.Errorf("parse JSON: %w", err)
	}

	if bp.Name == "" {
		bp.Name = strings.TrimSuffix(filepath.Base(filePath), ".json")
	}
	bp.Timestamp = time.Now().UnixMilli()

	return &bp, nil
}

// ImportFromURL downloads and imports a blueprint from a URL.
func ImportFromURL(url string) (*Blueprint, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("HTTP %d", resp.StatusCode)
	}

	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("read response: %w", err)
	}

	var bp Blueprint
	if err := json.Unmarshal(data, &bp); err != nil {
		return nil, fmt.Errorf("parse JSON: %w", err)
	}

	if bp.Name == "" {
		bp.Name = extractNameFromURL(url)
	}
	bp.Timestamp = time.Now().UnixMilli()

	return &bp, nil
}

// ImportBase16 parses a Base16 YAML file into a blueprint.
// Base16 YAML format: base00-base0F keys with hex values.
//
// Base16 colour mapping to ANSI 16-colour palette:
//
//	base00 → 0  (black / background)
//	base03 → 8  (bright black / comments)
//	base05 → 7  (white / foreground)
//	base07 → 15 (bright white)
//	base08 → 1  (red)          + 9  (bright red)
//	base0B → 2  (green)        + 10 (bright green)
//	base0A → 3  (yellow)       + 11 (bright yellow)
//	base0D → 4  (blue)         + 12 (bright blue)
//	base0E → 5  (magenta)      + 13 (bright magenta)
//	base0C → 6  (cyan)         + 14 (bright cyan)
func ImportBase16(filePath string) (*Blueprint, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	content := string(data)
	base := make(map[int]string, 16)
	var scheme, author string

	for _, line := range strings.Split(content, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || (strings.HasPrefix(line, "#") && !strings.Contains(line, ":")) {
			continue
		}

		if strings.HasPrefix(line, "scheme:") {
			scheme = parseYAMLValue(strings.TrimPrefix(line, "scheme:"))
		}
		if strings.HasPrefix(line, "author:") {
			author = parseYAMLValue(strings.TrimPrefix(line, "author:"))
		}

		// Parse base00-base0F
		for i := 0; i < 16; i++ {
			key := fmt.Sprintf("base%02X:", i)
			if strings.HasPrefix(line, key) {
				val := parseYAMLValue(strings.TrimPrefix(line, key))
				// Strip inline comments: "090300" #  ---- → 090300
				if idx := strings.Index(val, "#"); idx > 0 {
					before := val[:idx]
					if strings.TrimSpace(before) != "" {
						val = strings.TrimSpace(before)
					}
				}
				val = strings.Trim(val, `"' `)
				if val != "" && !strings.HasPrefix(val, "#") {
					val = "#" + val
				}
				base[i] = val
			}
		}
	}

	// Validate we got enough base colours
	if len(base) < 8 {
		return nil, fmt.Errorf("not enough colors found (got %d)", len(base))
	}

	// Map base16 to ANSI 16-colour palette
	colors := [16]string{
		base[0x00], // 0  black / background
		base[0x08], // 1  red
		base[0x0B], // 2  green
		base[0x0A], // 3  yellow
		base[0x0D], // 4  blue
		base[0x0E], // 5  magenta
		base[0x0C], // 6  cyan
		base[0x05], // 7  white / foreground
		base[0x03], // 8  bright black
		base[0x08], // 9  bright red
		base[0x0B], // 10 bright green
		base[0x0A], // 11 bright yellow
		base[0x0D], // 12 bright blue
		base[0x0E], // 13 bright magenta
		base[0x0C], // 14 bright cyan
		base[0x07], // 15 bright white
	}

	name := scheme
	if name == "" {
		name = strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	}
	_ = author

	bp := &Blueprint{
		Name: name,
		Palette: PaletteData{
			Colors: colors[:],
		},
		Timestamp: time.Now().UnixMilli(),
	}

	return bp, nil
}

// ImportColorsToml parses a colors.toml file into a blueprint.
func ImportColorsToml(filePath string) (*Blueprint, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, fmt.Errorf("read file: %w", err)
	}

	colors, bg, fg := omarchy.ParseColorsToml(string(data))

	// Fill empty slots: use bg for dark colors (0,8), fg for light colors (7,15)
	if bg == "" {
		bg = "#1a1b26"
	}
	if fg == "" {
		fg = "#a9b1d6"
	}
	for i := range colors {
		if colors[i] == "" {
			if i == 0 || i == 8 {
				colors[i] = bg
			} else if i == 7 || i == 15 {
				colors[i] = fg
			} else {
				// Still empty — leave as-is, will be caught below
			}
		}
	}

	filled := 0
	for _, c := range colors {
		if c != "" {
			filled++
		}
	}
	if filled < 2 {
		return nil, fmt.Errorf("not enough colors found (got %d of 16)", filled)
	}

	name := strings.TrimSuffix(filepath.Base(filePath), filepath.Ext(filePath))
	ext := map[string]string{}
	if bg != "" {
		ext["background"] = bg
	}
	if fg != "" {
		ext["foreground"] = fg
	}

	bp := &Blueprint{
		Name: name,
		Palette: PaletteData{
			Colors:         colors[:],
			ExtendedColors: ext,
		},
		Timestamp: time.Now().UnixMilli(),
	}

	return bp, nil
}

// parseYAMLValue extracts a clean value from a YAML line fragment.
func parseYAMLValue(raw string) string {
	v := strings.TrimSpace(raw)
	// Strip inline comments (# preceded by space)
	if idx := strings.Index(v, " #"); idx >= 0 {
		v = strings.TrimSpace(v[:idx])
	}
	v = strings.Trim(v, `"' `)
	return v
}

func extractNameFromURL(url string) string {
	parts := strings.Split(url, "/")
	if len(parts) > 0 {
		name := parts[len(parts)-1]
		name = strings.TrimSuffix(name, ".json")
		if name != "" {
			return name
		}
	}
	return "imported_blueprint"
}

// SaveImported saves an imported blueprint to the blueprints directory.
func SaveImported(bp *Blueprint) (string, error) {
	dir := platform.BlueprintDir()
	_ = platform.EnsureDir(dir)

	safeName := strings.ReplaceAll(bp.Name, "/", "-")
	safeName = strings.ReplaceAll(safeName, " ", "-")
	filename := fmt.Sprintf("%s_imported_%d.json", safeName, time.Now().Unix())
	path := filepath.Join(dir, filename)

	if err := platform.WriteJSON(path, bp); err != nil {
		return "", err
	}
	return path, nil
}
