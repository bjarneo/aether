package update

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"

	"aether/internal/platform"
)

// Upgrade installs the latest GitHub release. It is intended for a terminal,
// where sudo prompts can be answered by the user.
func Upgrade(ctx context.Context, release Release, stdout, stderr io.Writer) error {
	if !release.UpdateAvailable {
		fmt.Fprintf(stdout, "Aether %s is already up to date.\n", release.CurrentVersion)
		return nil
	}
	if runtime.GOOS != "linux" {
		return fmt.Errorf("automatic upgrades are currently supported on Linux only")
	}

	if isDebianPackageInstalled(ctx) {
		return installDebianPackage(ctx, release, stdout, stderr)
	}
	return installStandaloneBinary(ctx, release, stdout, stderr)
}

// OpenUpgradeTerminal starts the current executable's upgrade command in an
// available terminal emulator so authentication prompts remain interactive.
func OpenUpgradeTerminal(executable string) error {
	if runtime.GOOS != "linux" {
		return fmt.Errorf("automatic upgrades are currently supported on Linux only")
	}

	for _, terminal := range []struct {
		name string
		args []string
	}{
		{"x-terminal-emulator", []string{"-e"}},
		{"foot", []string{"-e"}},
		{"alacritty", []string{"-e"}},
		{"ghostty", []string{"-e"}},
		{"kitty", nil},
		{"wezterm", []string{"start", "--"}},
		{"gnome-terminal", []string{"--"}},
		{"konsole", []string{"-e"}},
	} {
		if !commandExists(terminal.name) {
			continue
		}
		args := append(terminal.args, executable, "upgrade")
		return exec.Command(terminal.name, args...).Start()
	}
	return fmt.Errorf("no supported terminal emulator found")
}

func commandExists(name string) bool {
	_, err := exec.LookPath(name)
	return err == nil
}

func runInteractive(ctx context.Context, stdout, stderr io.Writer, name string, args ...string) error {
	cmd := exec.CommandContext(ctx, name, args...)
	cmd.Stdin = os.Stdin
	cmd.Stdout = stdout
	cmd.Stderr = stderr
	if err := cmd.Run(); err != nil {
		return fmt.Errorf("run %s: %w", name, err)
	}
	return nil
}

func isDebianPackageInstalled(ctx context.Context) bool {
	if !commandExists("dpkg-query") {
		return false
	}
	cmd := exec.CommandContext(ctx, "dpkg-query", "-W", "-f=${Status}", "aether")
	return cmd.Run() == nil
}

func installDebianPackage(ctx context.Context, release Release, stdout, stderr io.Writer) error {
	assetName := fmt.Sprintf("aether_%s_%s.deb", release.LatestVersion, debianArch())
	packageURL := release.assetURL(assetName)
	if packageURL == "" {
		return fmt.Errorf("release %s does not include %s", release.LatestVersion, assetName)
	}

	packagePath, cleanup, err := downloadAsset(ctx, packageURL, assetName)
	if err != nil {
		return err
	}
	defer cleanup()

	if err := runInteractive(ctx, stdout, stderr, "sudo", "dpkg", "-i", packagePath); err != nil {
		return err
	}
	return registerURLHandler(ctx, stdout, stderr)
}

func installStandaloneBinary(ctx context.Context, release Release, stdout, stderr io.Writer) error {
	assetName := fmt.Sprintf("aether-linux-%s", runtime.GOARCH)
	binaryURL := release.assetURL(assetName)
	if binaryURL == "" {
		return fmt.Errorf("release %s does not include %s", release.LatestVersion, assetName)
	}

	binaryPath, cleanup, err := downloadAsset(ctx, binaryURL, assetName)
	if err != nil {
		return err
	}
	defer cleanup()

	executable, err := os.Executable()
	if err != nil {
		return fmt.Errorf("locate current executable: %w", err)
	}
	if os.Geteuid() == 0 {
		if err := runInteractive(ctx, stdout, stderr, "install", "-m", "755", binaryPath, executable); err != nil {
			return err
		}
		return registerURLHandler(ctx, stdout, stderr)
	}
	if err := runInteractive(ctx, stdout, stderr, "sudo", "install", "-m", "755", binaryPath, executable); err != nil {
		return err
	}
	return registerURLHandler(ctx, stdout, stderr)
}

func registerURLHandler(ctx context.Context, stdout, stderr io.Writer) error {
	if err := platform.EnsureURLHandler(ctx); err != nil {
		return fmt.Errorf("register aether:// handler: %w", err)
	}
	fmt.Fprintln(stdout, "Registered aether:// as the default protocol handler.")
	return nil
}

func debianArch() string {
	if runtime.GOARCH == "arm64" {
		return "arm64"
	}
	return "amd64"
}

func downloadAsset(ctx context.Context, url, name string) (string, func(), error) {
	request, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", nil, fmt.Errorf("create download request: %w", err)
	}
	response, err := http.DefaultClient.Do(request)
	if err != nil {
		return "", nil, fmt.Errorf("download %s: %w", name, err)
	}
	defer response.Body.Close()
	if response.StatusCode != http.StatusOK {
		return "", nil, fmt.Errorf("download %s: GitHub returned %s", name, response.Status)
	}

	dir, err := os.MkdirTemp("", "aether-upgrade-*")
	if err != nil {
		return "", nil, fmt.Errorf("create temporary directory: %w", err)
	}
	cleanup := func() { _ = os.RemoveAll(dir) }
	path := filepath.Join(dir, name)
	file, err := os.Create(path)
	if err != nil {
		cleanup()
		return "", nil, fmt.Errorf("create %s: %w", name, err)
	}
	if _, err := io.Copy(file, response.Body); err != nil {
		_ = file.Close()
		cleanup()
		return "", nil, fmt.Errorf("write %s: %w", name, err)
	}
	if err := file.Close(); err != nil {
		cleanup()
		return "", nil, fmt.Errorf("close %s: %w", name, err)
	}
	return path, cleanup, nil
}
