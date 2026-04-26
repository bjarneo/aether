package favorites

import (
	"encoding/json"
	"log"
	"os"
	"path/filepath"
	"sync"

	"aether/internal/platform"
)

// Favorite represents a favorited wallpaper.
type Favorite struct {
	Path string                 `json:"path"`
	Type string                 `json:"type,omitempty"`
	Data map[string]interface{} `json:"data,omitempty"`
}

// wallhavenEntry is the on-disk format for wallhaven favorites.
type wallhavenEntry struct {
	ID         string            `json:"id,omitempty"`
	Path       string            `json:"path"`
	Thumbs     map[string]string `json:"thumbs,omitempty"`
	Resolution string            `json:"resolution,omitempty"`
	FileSize   int64             `json:"file_size,omitempty"`
}

// localEntry is the on-disk format for local favorites.
type localEntry struct {
	Path string `json:"path"`
	Name string `json:"name,omitempty"`
}

// Service manages wallpaper favorites with JSON persistence.
type Service struct {
	mu         sync.RWMutex
	configPath string
	favorites  []json.RawMessage // preserve original format
	pathIndex  map[string]int    // path → index into favorites slice
}

// NewService creates a favorites service and loads existing favorites.
func NewService() *Service {
	s := &Service{
		configPath: platform.FavoritesFile(),
		pathIndex:  make(map[string]int),
	}
	s.load()
	return s
}

// IsFavorite checks if a path is favorited.
func (s *Service) IsFavorite(path string) bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	_, ok := s.pathIndex[path]
	return ok
}

// Toggle adds or removes a favorite, returning true if now favorited.
func (s *Service) Toggle(path, favType string, data map[string]interface{}) bool {
	s.mu.Lock()
	defer s.mu.Unlock()

	if idx, ok := s.pathIndex[path]; ok {
		// Remove
		s.favorites = append(s.favorites[:idx], s.favorites[idx+1:]...)
		s.rebuildIndex()
		s.save()
		return false
	}

	// Add
	entry := s.buildEntry(path, favType, data)
	raw, _ := json.Marshal(entry)
	s.favorites = append(s.favorites, raw)
	s.pathIndex[path] = len(s.favorites) - 1
	s.save()
	return true
}

// GetAll returns all favorites in a standard format.
func (s *Service) GetAll() []Favorite {
	s.mu.RLock()
	defer s.mu.RUnlock()

	var result []Favorite
	for _, raw := range s.favorites {
		var obj map[string]interface{}
		if err := json.Unmarshal(raw, &obj); err != nil {
			continue
		}

		path, _ := obj["path"].(string)
		if path == "" {
			continue
		}

		fav := Favorite{Path: path, Data: make(map[string]interface{})}

		if _, ok := obj["id"]; ok {
			// Wallhaven format
			fav.Type = "wallhaven"
			fav.Data["id"] = obj["id"]
			fav.Data["resolution"] = obj["resolution"]
			fav.Data["file_size"] = obj["file_size"]
			if thumbs, ok := obj["thumbs"].(map[string]interface{}); ok {
				if small, ok := thumbs["small"].(string); ok {
					fav.Data["thumbUrl"] = small
				}
			}
		} else if _, ok := obj["name"]; ok {
			// Local format
			fav.Type = "local"
			fav.Data["name"] = obj["name"]
		}

		result = append(result, fav)
	}
	return result
}

// Count returns the number of favorites.
func (s *Service) Count() int {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return len(s.favorites)
}

func (s *Service) load() {
	data, err := os.ReadFile(s.configPath)
	if err != nil {
		return
	}

	var entries []json.RawMessage
	if err := json.Unmarshal(data, &entries); err != nil {
		return
	}

	for _, raw := range entries {
		// Handle potential double-encoded strings
		var str string
		if err := json.Unmarshal(raw, &str); err == nil {
			// It was a string — parse the inner JSON
			raw = json.RawMessage(str)
		}

		var obj map[string]interface{}
		if err := json.Unmarshal(raw, &obj); err != nil {
			continue
		}

		path, _ := obj["path"].(string)
		if path == "" {
			continue
		}

		s.favorites = append(s.favorites, raw)
		s.pathIndex[path] = len(s.favorites) - 1
	}
}

func (s *Service) save() {
	dir := filepath.Dir(s.configPath)
	if err := platform.EnsureDir(dir); err != nil {
		log.Printf("[favorites] ensure dir %s: %v", dir, err)
	}

	// Parse raw messages back to objects for clean output
	var objects []interface{}
	for _, raw := range s.favorites {
		var obj interface{}
		if err := json.Unmarshal(raw, &obj); err == nil {
			objects = append(objects, obj)
		}
	}

	data, err := json.MarshalIndent(objects, "", "  ")
	if err != nil {
		return
	}
	_ = os.WriteFile(s.configPath, data, 0644)
}

func (s *Service) rebuildIndex() {
	s.pathIndex = make(map[string]int, len(s.favorites))
	for i, raw := range s.favorites {
		var obj map[string]interface{}
		if err := json.Unmarshal(raw, &obj); err == nil {
			if path, ok := obj["path"].(string); ok {
				s.pathIndex[path] = i
			}
		}
	}
}

func (s *Service) buildEntry(path, favType string, data map[string]interface{}) interface{} {
	switch favType {
	case "wallhaven":
		e := wallhavenEntry{Path: path}
		if data != nil {
			if id, ok := data["id"].(string); ok {
				e.ID = id
			}
			if res, ok := data["resolution"].(string); ok {
				e.Resolution = res
			}
			if thumbURL, ok := data["thumbUrl"].(string); ok {
				e.Thumbs = map[string]string{"small": thumbURL}
			}
		}
		return e
	case "local":
		e := localEntry{Path: path}
		if data != nil {
			if name, ok := data["name"].(string); ok {
				e.Name = name
			}
		}
		if e.Name == "" {
			e.Name = filepath.Base(path)
		}
		return e
	default:
		return map[string]string{"path": path}
	}
}
