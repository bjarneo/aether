package icontheme

import (
	"bufio"
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"unicode"
)

type directoryMetadata struct {
	name      string
	size      int
	scale     int
	kind      string
	minSize   int
	maxSize   int
	threshold int
	context   string
}

type themeMetadata struct {
	name        string
	hidden      bool
	inherits    []string
	directories []directoryMetadata
}

func parseThemeMetadata(path string, roots []canonicalRoot) (themeMetadata, error) {
	resolved, err := resolveContained(path, roots, false)
	if err != nil {
		return themeMetadata{}, err
	}
	data, err := readBoundedRegularFile(resolved, MaxMetadataBytes)
	if err != nil {
		return themeMetadata{}, err
	}
	sections, err := parseINI(data)
	if err != nil {
		return themeMetadata{}, err
	}
	main, ok := sections["Icon Theme"]
	if !ok {
		return themeMetadata{}, errors.New("missing Icon Theme group")
	}

	metadata := themeMetadata{
		name:   safeDisplayName(main["Name"]),
		hidden: strings.EqualFold(strings.TrimSpace(main["Hidden"]), "true"),
	}
	for _, value := range splitCSV(main["Inherits"]) {
		if ValidateID(value) == nil && !containsString(metadata.inherits, value) {
			metadata.inherits = append(metadata.inherits, value)
		}
	}
	directoryNames := append(splitCSV(main["Directories"]), splitCSV(main["ScaledDirectories"])...)
	seenDirectories := make(map[string]struct{})
	for _, name := range directoryNames {
		if !safeRelativeDirectory(name) {
			continue
		}
		if _, ok := seenDirectories[name]; ok {
			continue
		}
		seenDirectories[name] = struct{}{}
		section := sections[name]
		metadata.directories = append(metadata.directories, directoryMetadata{
			name:      name,
			size:      boundedPositiveInt(section["Size"], 0, 4096),
			scale:     boundedPositiveInt(section["Scale"], 1, 16),
			kind:      strings.ToLower(strings.TrimSpace(section["Type"])),
			minSize:   boundedPositiveInt(section["MinSize"], 0, 4096),
			maxSize:   boundedPositiveInt(section["MaxSize"], 0, 4096),
			threshold: boundedPositiveInt(section["Threshold"], 2, 4096),
			context:   strings.TrimSpace(section["Context"]),
		})
	}
	return metadata, nil
}

func readBoundedRegularFile(path string, limit int64) ([]byte, error) {
	file, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer file.Close()
	info, err := file.Stat()
	if err != nil {
		return nil, err
	}
	if !info.Mode().IsRegular() || info.Size() > limit {
		return nil, errors.New("file is not a bounded regular file")
	}
	data, err := io.ReadAll(io.LimitReader(file, limit+1))
	if err != nil {
		return nil, err
	}
	if int64(len(data)) > limit {
		return nil, errors.New("file exceeds size limit")
	}
	return data, nil
}

func parseINI(data []byte) (map[string]map[string]string, error) {
	sections := make(map[string]map[string]string)
	section := ""
	scanner := bufio.NewScanner(bytes.NewReader(data))
	// Scanner's maximum also accounts for the delimiter, so reserve enough
	// room to inspect and explicitly enforce the advertised line-byte limit.
	scanner.Buffer(make([]byte, 1024), MaxMetadataLineBytes+2)
	for scanner.Scan() {
		if len(scanner.Bytes()) > MaxMetadataLineBytes {
			return nil, errors.New("INI line exceeds size limit")
		}
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, ";") {
			continue
		}
		if strings.HasPrefix(line, "[") {
			if !strings.HasSuffix(line, "]") || len(line) < 3 {
				return nil, errors.New("malformed INI group")
			}
			section = strings.TrimSpace(line[1 : len(line)-1])
			if section == "" {
				return nil, errors.New("empty INI group")
			}
			if sections[section] == nil {
				sections[section] = make(map[string]string)
			}
			continue
		}
		if section == "" {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		if key != "" {
			sections[section][key] = strings.TrimSpace(value)
		}
	}
	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("read INI: %w", err)
	}
	return sections, nil
}

func safeDisplayName(value string) string {
	value = strings.TrimSpace(value)
	if value == "" || len(value) > 512 {
		return ""
	}
	for _, r := range value {
		if unicode.IsControl(r) {
			return ""
		}
	}
	return value
}

func safeRelativeDirectory(value string) bool {
	if value == "" || filepath.IsAbs(value) || strings.Contains(value, `\`) {
		return false
	}
	clean := filepath.Clean(value)
	return clean == value && clean != "." && clean != ".." && !strings.HasPrefix(clean, ".."+string(filepath.Separator))
}

func splitCSV(value string) []string {
	parts := strings.Split(value, ",")
	result := make([]string, 0, len(parts))
	for _, part := range parts {
		if value := strings.TrimSpace(part); value != "" {
			result = append(result, value)
		}
	}
	return result
}

func boundedPositiveInt(value string, fallback, maximum int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed < 0 || parsed > maximum {
		return fallback
	}
	return parsed
}

func containsString(values []string, target string) bool {
	for _, value := range values {
		if value == target {
			return true
		}
	}
	return false
}
