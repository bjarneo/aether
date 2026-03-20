package wallhaven

// SearchParams holds the query parameters for a wallhaven.cc search.
type SearchParams struct {
	Query      string `json:"q"`
	Categories string `json:"categories"` // "111" = all, "100" = general, etc.
	Purity     string `json:"purity"`     // "100" = SFW
	Sorting    string `json:"sorting"`    // date_added, relevance, random, views, favorites, toplist
	Order      string `json:"order"`      // desc, asc
	Page       int    `json:"page"`
	AtLeast    string `json:"atleast"` // "1920x1080"
	Colors     string `json:"colors"`  // hex without #
}

// SearchResult is the top-level JSON response from the wallhaven search API.
type SearchResult struct {
	Data []WallpaperInfo `json:"data"`
	Meta SearchMeta      `json:"meta"`
}

// SearchMeta contains pagination metadata from a search response.
type SearchMeta struct {
	CurrentPage int    `json:"current_page"`
	LastPage    int    `json:"last_page"`
	Total       int    `json:"total"`
	Seed        string `json:"seed,omitempty"`
}

// WallpaperInfo describes a single wallpaper returned by the wallhaven API.
type WallpaperInfo struct {
	ID         string            `json:"id"`
	URL        string            `json:"url"`
	Path       string            `json:"path"`
	Resolution string            `json:"resolution"`
	FileSize   int64             `json:"file_size"`
	Category   string            `json:"category"`
	Purity     string            `json:"purity"`
	Thumbs     map[string]string `json:"thumbs"`
}
