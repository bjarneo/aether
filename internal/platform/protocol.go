package platform

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strconv"
	"strings"
)

const urlHandlerDesktopFile = "li.oever.aether.url-handler.desktop"

// EnsureURLHandler makes Aether the current user's handler for aether:// URLs.
func EnsureURLHandler(ctx context.Context) error {
	if runtime.GOOS != "linux" {
		return nil
	}
	if !CommandExists("xdg-mime") {
		return fmt.Errorf("xdg-mime is required to register aether:// links")
	}

	current, err := exec.CommandContext(ctx, "xdg-mime", "query", "default", "x-scheme-handler/aether").Output()
	if err == nil && strings.TrimSpace(string(current)) == urlHandlerDesktopFile {
		return nil
	}
	if err := ensureURLHandlerDesktopEntry(); err != nil {
		return err
	}
	if err := exec.CommandContext(ctx, "xdg-mime", "default", urlHandlerDesktopFile, "x-scheme-handler/aether").Run(); err != nil {
		return fmt.Errorf("set aether:// handler: %w", err)
	}
	return nil
}

func ensureURLHandlerDesktopEntry() error {
	dataDir, err := userDataDir()
	if err != nil {
		return fmt.Errorf("locate user data directory: %w", err)
	}
	applicationsDir := filepath.Join(dataDir, "applications")
	path := filepath.Join(applicationsDir, urlHandlerDesktopFile)
	if _, err := os.Stat(path); err == nil {
		return nil
	} else if !os.IsNotExist(err) {
		return fmt.Errorf("inspect aether URL handler: %w", err)
	}

	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate Aether executable: %w", err)
	}
	if err := os.MkdirAll(applicationsDir, 0o755); err != nil {
		return fmt.Errorf("create applications directory: %w", err)
	}
	entry := fmt.Sprintf(`[Desktop Entry]
Name=Aether URL Handler
Comment=Apply themes, colors, and wallpapers from aether:// web links
Exec=%s --handle-url %%u
Icon=aether
Terminal=false
Type=Application
NoDisplay=true
MimeType=x-scheme-handler/aether;
Categories=Utility;
Keywords=theme;color;wallpaper;import;
StartupNotify=false
`, strconv.Quote(executable))
	if err := os.WriteFile(path, []byte(entry), 0o644); err != nil {
		return fmt.Errorf("write aether URL handler: %w", err)
	}
	if CommandExists("update-desktop-database") {
		_ = exec.Command("update-desktop-database", applicationsDir).Run()
	}
	return nil
}

func userDataDir() (string, error) {
	if dir := os.Getenv("XDG_DATA_HOME"); dir != "" {
		return dir, nil
	}
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, ".local", "share"), nil
}
