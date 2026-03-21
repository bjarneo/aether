package theme

import (
	"log"
	"os"
	"path/filepath"
	"runtime"

	"aether/internal/platform"
)

// ApplyGTKTheme copies the generated gtk.css from gtkCSSPath to both
// ~/.config/gtk-3.0/gtk.css and ~/.config/gtk-4.0/gtk.css, creating
// backup files of any existing gtk.css before overwriting.
// Only runs on Linux.
func ApplyGTKTheme(gtkCSSPath string) error {
	if runtime.GOOS != "linux" {
		return nil
	}
	if !platform.FileExists(gtkCSSPath) {
		log.Println("gtk.css not found in theme directory, skipping GTK theme application")
		return nil
	}

	home, err := os.UserHomeDir()
	if err != nil {
		return err
	}
	configDir := filepath.Join(home, ".config")

	gtk3Dir := filepath.Join(configDir, "gtk-3.0")
	gtk4Dir := filepath.Join(configDir, "gtk-4.0")

	if err := platform.EnsureDir(gtk3Dir); err != nil {
		return err
	}
	if err := platform.EnsureDir(gtk4Dir); err != nil {
		return err
	}

	gtk3Dest := filepath.Join(gtk3Dir, "gtk.css")
	gtk4Dest := filepath.Join(gtk4Dir, "gtk.css")

	// Copy to GTK3 (with backup)
	if err := copyGTKFile(gtkCSSPath, gtk3Dest, "GTK3"); err != nil {
		log.Printf("Warning: %v", err)
	}

	// Copy to GTK4 (with backup)
	if err := copyGTKFile(gtkCSSPath, gtk4Dest, "GTK4"); err != nil {
		log.Printf("Warning: %v", err)
	}

	log.Println("GTK theme applied successfully to GTK3 and GTK4")
	return nil
}

// copyGTKFile copies src to dest, creating a .backup of dest first if it
// exists.
func copyGTKFile(src, dest, label string) error {
	// Create backup if destination exists
	if platform.FileExists(dest) {
		backupPath := dest + ".backup"
		if err := platform.CopyFile(dest, backupPath); err != nil {
			log.Printf("Warning: could not create %s backup: %v", label, err)
		} else {
			log.Printf("Created %s backup: %s", label, backupPath)
		}
	}

	if err := platform.CopyFile(src, dest); err != nil {
		return err
	}

	// Set permissions to 0644
	if err := os.Chmod(dest, 0644); err != nil {
		log.Printf("Warning: could not set permissions on %s: %v", dest, err)
	}

	log.Printf("%s theme copied to: %s", label, dest)
	return nil
}
