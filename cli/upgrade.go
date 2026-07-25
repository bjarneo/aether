package cli

import (
	"context"
	"fmt"
	"os"

	"aether/internal/update"
)

func runUpgrade(args []string) int {
	if len(args) > 0 {
		fmt.Fprintln(os.Stderr, "Usage: aether upgrade")
		return 1
	}
	if Version == "dev" {
		fmt.Fprintln(os.Stderr, "A development build cannot upgrade itself. Install a release build first.")
		return 1
	}

	release, err := update.Check(context.Background(), Version)
	if err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	if !release.UpdateAvailable {
		fmt.Printf("Aether %s is already up to date.\n", release.CurrentVersion)
		return 0
	}

	fmt.Printf("Upgrading Aether %s to %s...\n", release.CurrentVersion, release.LatestVersion)
	if err := update.Upgrade(context.Background(), release, os.Stdout, os.Stderr); err != nil {
		fmt.Fprintf(os.Stderr, "Error: %v\n", err)
		return 1
	}
	fmt.Printf("Aether %s installed. Restart Aether to use the new version.\n", release.LatestVersion)
	return 0
}
