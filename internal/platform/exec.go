package platform

import (
	"bytes"
	"encoding/json"
	"fmt"
	"math"
	"os"
	"os/exec"
	"strings"
)

// RunSync executes a command synchronously and returns its combined stdout.
// LD_PRELOAD is stripped from the environment to prevent layer-shell conflicts.
func RunSync(name string, args ...string) (string, error) {
	return RunSyncEnv(nil, name, args...)
}

// RunSyncEnv executes a command with additional environment values and returns
// its combined output. Values in extraEnv replace inherited values.
func RunSyncEnv(extraEnv map[string]string, name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Env = mergeEnv(filteredEnv(), extraEnv)

	var output bytes.Buffer
	cmd.Stdout = &output
	cmd.Stderr = &output

	if err := cmd.Run(); err != nil {
		message := strings.TrimSpace(output.String())
		if message != "" {
			return output.String(), fmt.Errorf("%s: %w", message, err)
		}
		return output.String(), err
	}
	return output.String(), nil
}

// RunAsync starts a command detached in the background and returns immediately.
// LD_PRELOAD is stripped from the environment to prevent layer-shell conflicts.
func RunAsync(name string, args ...string) error {
	cmd := exec.Command(name, args...)
	cmd.Env = filteredEnv()

	// Detach: discard all stdio so the child doesn't hold our fds.
	cmd.Stdin = nil
	cmd.Stdout = nil
	cmd.Stderr = nil

	return cmd.Start()
}

// CommandExists reports whether name resolves to an executable in PATH.
func CommandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

// IsNvidiaWayland returns true if running on Wayland with an NVIDIA GPU.
// Checks XDG_SESSION_TYPE and /proc/driver/nvidia/version.
func IsNvidiaWayland() bool {
	if os.Getenv("XDG_SESSION_TYPE") != "wayland" &&
		os.Getenv("WAYLAND_DISPLAY") == "" {
		return false
	}
	_, err := os.Stat("/proc/driver/nvidia/version")
	return err == nil
}

// SetupOverlayWindow makes the given window class a full-screen floating overlay.
// On Hyprland it injects session-scoped windowrules via hyprctl; on other WMs
// it is a no-op (the Wails AlwaysOnTop + Frameless flags handle it).
func SetupOverlayWindow(appClass string) {
	if os.Getenv("HYPRLAND_INSTANCE_SIGNATURE") == "" {
		return
	}
	w, h := hyprlandMonitorSize()
	match := "match:class " + appClass
	rules := []string{
		match + ", float true",
		match + ", pin true",
		match + ", animation false",
		match + ", border_size 0",
		fmt.Sprintf("%s, size %d %d", match, w, h),
		match + ", move 0 0",
	}
	batch := make([]string, len(rules))
	for i, rule := range rules {
		batch[i] = "keyword windowrule " + rule
	}
	exec.Command("hyprctl", "--batch", strings.Join(batch, " ; ")).Run()
}

// MonitorSize returns the effective (scaled) pixel dimensions of the focused
// monitor. On Hyprland it queries hyprctl; elsewhere it falls back to 1920x1080.
func MonitorSize() (int, int) {
	if os.Getenv("HYPRLAND_INSTANCE_SIGNATURE") == "" {
		return 1920, 1080
	}
	return hyprlandMonitorSize()
}

// hyprlandMonitorSize returns the effective (scaled) pixel dimensions of the
// focused monitor via hyprctl.
func hyprlandMonitorSize() (int, int) {
	out, err := exec.Command("hyprctl", "monitors", "-j").Output()
	if err != nil {
		return 1920, 1080
	}
	var monitors []struct {
		Width   int     `json:"width"`
		Height  int     `json:"height"`
		Scale   float64 `json:"scale"`
		Focused bool    `json:"focused"`
	}
	if json.Unmarshal(out, &monitors) != nil {
		return 1920, 1080
	}
	// Prefer the focused monitor, fall back to first.
	m := monitors[0]
	for _, mon := range monitors {
		if mon.Focused {
			m = mon
			break
		}
	}
	s := m.Scale
	if s <= 0 {
		s = 1
	}
	return int(math.Round(float64(m.Width) / s)),
		int(math.Round(float64(m.Height) / s))
}

// filteredEnv returns a copy of the current environment with LD_PRELOAD removed.
func filteredEnv() []string {
	env := os.Environ()
	filtered := make([]string, 0, len(env))
	for _, v := range env {
		if strings.HasPrefix(v, "LD_PRELOAD=") {
			continue
		}
		filtered = append(filtered, v)
	}
	return filtered
}

func mergeEnv(env []string, extra map[string]string) []string {
	if len(extra) == 0 {
		return env
	}

	merged := make([]string, 0, len(env)+len(extra))
	for _, value := range env {
		key, _, _ := strings.Cut(value, "=")
		if _, replaced := extra[key]; !replaced {
			merged = append(merged, value)
		}
	}
	for key, value := range extra {
		merged = append(merged, key+"="+value)
	}
	return merged
}
