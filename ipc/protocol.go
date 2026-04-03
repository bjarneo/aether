package ipc

import "aether/internal/platform"

// DefaultSocketPath returns the path for the Aether IPC socket.
func DefaultSocketPath() string {
	return platform.ConfigDir() + "/aether.sock"
}

// Request is a JSON command sent from the CLI client to the running Aether GUI.
type Request struct {
	Cmd  string `json:"cmd"`
	Path string `json:"path,omitempty"` // wallpaper path for extract/set-wallpaper
	Mode string `json:"mode,omitempty"` // extraction mode
	Name string `json:"name,omitempty"` // blueprint name

	// Color manipulation
	Index int    `json:"index,omitempty"` // palette index for set-color
	Value string `json:"value,omitempty"` // hex value for set-color

	// Palette replacement
	Palette []string `json:"palette,omitempty"`

	// Adjustment sliders
	Vibrance    *float64 `json:"vibrance,omitempty"`
	Saturation  *float64 `json:"saturation,omitempty"`
	Contrast    *float64 `json:"contrast,omitempty"`
	Brightness  *float64 `json:"brightness,omitempty"`
	Shadows     *float64 `json:"shadows,omitempty"`
	Highlights  *float64 `json:"highlights,omitempty"`
	HueShift    *float64 `json:"hue_shift,omitempty"`
	Temperature *float64 `json:"temperature,omitempty"`
	Tint        *float64 `json:"tint,omitempty"`
	Gamma       *float64 `json:"gamma,omitempty"`
	BlackPoint  *float64 `json:"black_point,omitempty"`
	WhitePoint  *float64 `json:"white_point,omitempty"`

	// Boolean flags
	LightMode *bool `json:"light_mode,omitempty"`
}

// Response is the JSON reply from the Aether GUI back to the CLI client.
type Response struct {
	OK    bool   `json:"ok"`
	Error string `json:"error,omitempty"`

	// Status fields (returned by "status" and state-changing commands)
	Palette   []string `json:"palette,omitempty"`
	LightMode *bool    `json:"light_mode,omitempty"`
	Mode      string   `json:"mode,omitempty"`
	Wallpaper string   `json:"wallpaper,omitempty"`
}
