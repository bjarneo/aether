package platform

import (
	"bytes"
	"os"
	"os/exec"
	"strings"
)

// RunSync executes a command synchronously and returns its combined stdout.
// LD_PRELOAD is stripped from the environment to prevent layer-shell conflicts.
func RunSync(name string, args ...string) (string, error) {
	cmd := exec.Command(name, args...)
	cmd.Env = filteredEnv()

	var stdout bytes.Buffer
	cmd.Stdout = &stdout
	cmd.Stderr = nil

	if err := cmd.Run(); err != nil {
		return stdout.String(), err
	}
	return stdout.String(), nil
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
