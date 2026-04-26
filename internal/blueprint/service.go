package blueprint

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
	"time"

	"aether/internal/platform"
)

// Service manages blueprint persistence.
type Service struct {
	dir string
}

// NewService creates a new blueprint service.
func NewService() *Service {
	dir := platform.BlueprintDir()
	if err := platform.EnsureDir(dir); err != nil {
		log.Printf("[blueprint] ensure dir %s: %v", dir, err)
	}
	return &Service{dir: dir}
}

// LoadAll reads all blueprints from the blueprints directory.
func (s *Service) LoadAll() ([]Blueprint, error) {
	entries, err := os.ReadDir(s.dir)
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, fmt.Errorf("read blueprints dir: %w", err)
	}

	var blueprints []Blueprint
	for _, entry := range entries {
		if entry.IsDir() || !strings.HasSuffix(entry.Name(), ".json") {
			continue
		}
		path := filepath.Join(s.dir, entry.Name())
		bp, err := s.loadFromFile(path, entry.Name())
		if err != nil {
			continue
		}
		blueprints = append(blueprints, bp)
	}
	return blueprints, nil
}

// FindByName finds a blueprint by name (case-insensitive).
func (s *Service) FindByName(name string) (*Blueprint, error) {
	blueprints, err := s.LoadAll()
	if err != nil {
		return nil, err
	}

	lower := strings.ToLower(name)

	// Exact name match first
	for i := range blueprints {
		if strings.ToLower(blueprints[i].Name) == lower {
			return &blueprints[i], nil
		}
	}

	// Partial filename match
	for i := range blueprints {
		fn := strings.ToLower(strings.TrimSuffix(blueprints[i].Filename, ".json"))
		if strings.Contains(fn, lower) {
			return &blueprints[i], nil
		}
	}

	return nil, nil
}

// Save persists a blueprint to disk.
func (s *Service) Save(name string, bp Blueprint) error {
	bp.Name = name
	bp.Timestamp = time.Now().UnixMilli()

	// Sanitize filename
	safeName := strings.ReplaceAll(name, "/", "-")
	safeName = strings.ReplaceAll(safeName, " ", "-")
	filename := safeName + ".json"
	path := filepath.Join(s.dir, filename)

	return platform.WriteJSON(path, bp)
}

// Delete removes a blueprint by name.
func (s *Service) Delete(name string) error {
	bp, err := s.FindByName(name)
	if err != nil {
		return err
	}
	if bp == nil {
		return fmt.Errorf("blueprint %q not found", name)
	}
	return os.Remove(bp.Path)
}

// Validate checks if a blueprint has the minimum required structure.
func (s *Service) Validate(bp *Blueprint) bool {
	if bp == nil {
		return false
	}
	return len(bp.Palette.Colors) >= 16
}

func (s *Service) loadFromFile(path, filename string) (Blueprint, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return Blueprint{}, err
	}

	var bp Blueprint
	if err := json.Unmarshal(data, &bp); err != nil {
		return Blueprint{}, err
	}

	bp.Path = path
	bp.Filename = filename
	if bp.Name == "" {
		bp.Name = strings.TrimSuffix(filename, ".json")
	}

	return bp, nil
}
