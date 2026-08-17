package theme

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"runtime"

	"aether/internal/platform"
)

const legacyGTKMarker = "Aether Theme with Sharp Corners (Hyprland-inspired)"

// RetireLegacyGTKStylesheets deactivates stylesheets installed by older Aether
// versions without touching unrecognized files or existing backups.
func RetireLegacyGTKStylesheets() error {
	var errs []error
	if runtime.GOOS == "linux" {
		home, err := os.UserHomeDir()
		if err != nil {
			errs = append(errs, err)
		} else {
			for _, version := range []string{"gtk-3.0", "gtk-4.0"} {
				path := filepath.Join(home, ".config", version, "gtk.css")
				retired, err := retireLegacyGTKStylesheet(path)
				if err != nil {
					errs = append(errs, fmt.Errorf("retire %s: %w", path, err))
					continue
				}
				if retired {
					log.Printf("Retired legacy Aether GTK stylesheet: %s", path)
				}
			}
		}
	}

	generatedPath := filepath.Join(platform.ThemeDir(), "gtk.css")
	if err := removeLegacyGTKStylesheet(generatedPath); err != nil {
		errs = append(errs, fmt.Errorf("remove %s: %w", generatedPath, err))
	}
	return errors.Join(errs...)
}

func retireLegacyGTKStylesheet(path string) (bool, error) {
	regular, owned, err := inspectLegacyGTKStylesheet(path, true)
	if err != nil || !regular || !owned {
		return false, err
	}
	info, err := os.Lstat(path)
	if err != nil {
		return false, err
	}
	isSymlink := info.Mode()&os.ModeSymlink != 0

	backupPath := path + ".backup"
	backupRegular, backupOwned, err := inspectLegacyGTKStylesheet(backupPath, false)
	if err != nil {
		return false, err
	}

	if _, err := archiveLegacyGTKFile(path, path+".aether-legacy"); err != nil {
		return false, err
	}

	if isSymlink {
		return retireLegacyGTKSymlink(path, backupPath, backupRegular && !backupOwned)
	}
	return retireLegacyGTKRegularFile(path, backupPath, backupRegular && !backupOwned)
}

func retireLegacyGTKRegularFile(path, backupPath string, restoreBackup bool) (bool, error) {
	if !restoreBackup {
		if err := verifyLegacyGTKPath(path, false); err != nil {
			return false, err
		}
		if err := os.Remove(path); err != nil {
			return false, err
		}
		return true, nil
	}

	tempPath, err := prepareLegacyGTKReplacement(backupPath, path)
	if err != nil {
		return false, err
	}
	defer os.Remove(tempPath)
	if err := verifyLegacyGTKPath(path, false); err != nil {
		return false, err
	}
	if err := os.Rename(tempPath, path); err != nil {
		return false, fmt.Errorf("restore backup: %w", err)
	}
	return true, nil
}

func retireLegacyGTKSymlink(path, backupPath string, restoreBackup bool) (bool, error) {
	targetPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return false, err
	}
	if !restoreBackup {
		linkTarget, err := os.Readlink(path)
		if err != nil {
			return false, err
		}
		if _, err := createLegacyGTKSymlink(linkTarget, path+".aether-legacy-link"); err != nil {
			return false, err
		}
		if err := verifyLegacyGTKSymlink(path, targetPath, linkTarget); err != nil {
			return false, err
		}
		if err := os.Remove(path); err != nil {
			return false, err
		}
		return true, nil
	}

	tempPath, err := prepareLegacyGTKReplacement(backupPath, targetPath)
	if err != nil {
		return false, err
	}
	defer os.Remove(tempPath)
	linkTarget, err := os.Readlink(path)
	if err != nil {
		return false, err
	}
	if err := verifyLegacyGTKSymlink(path, targetPath, linkTarget); err != nil {
		return false, err
	}
	if err := os.Rename(tempPath, targetPath); err != nil {
		return false, fmt.Errorf("restore backup: %w", err)
	}
	return true, nil
}

func removeLegacyGTKStylesheet(path string) error {
	regular, owned, err := inspectLegacyGTKStylesheet(path, false)
	if err != nil || !regular || !owned {
		return err
	}
	if err := verifyLegacyGTKPath(path, false); err != nil {
		return err
	}
	return os.Remove(path)
}

func inspectLegacyGTKStylesheet(path string, followSymlink bool) (regular, owned bool, err error) {
	info, err := os.Lstat(path)
	if os.IsNotExist(err) {
		return false, false, nil
	}
	if err != nil {
		return false, false, err
	}
	if info.Mode()&os.ModeSymlink != 0 {
		if !followSymlink {
			return false, false, nil
		}
		info, err = os.Stat(path)
		if err != nil {
			return false, false, err
		}
	}
	if !info.Mode().IsRegular() {
		return false, false, nil
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return true, false, err
	}
	return true, bytes.Contains(data, []byte(legacyGTKMarker)), nil
}

func verifyLegacyGTKPath(path string, wantSymlink bool) error {
	info, err := os.Lstat(path)
	if err != nil {
		return err
	}
	if (info.Mode()&os.ModeSymlink != 0) != wantSymlink {
		return fmt.Errorf("stylesheet changed during retirement")
	}
	regular, owned, err := inspectLegacyGTKStylesheet(path, true)
	if err != nil {
		return err
	}
	if !regular || !owned {
		return fmt.Errorf("stylesheet changed during retirement")
	}
	return nil
}

func verifyLegacyGTKSymlink(path, targetPath, linkTarget string) error {
	if err := verifyLegacyGTKPath(path, true); err != nil {
		return err
	}
	currentLinkTarget, err := os.Readlink(path)
	if err != nil {
		return err
	}
	currentTargetPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return err
	}
	if currentLinkTarget != linkTarget || currentTargetPath != targetPath {
		return fmt.Errorf("stylesheet symlink changed during retirement")
	}
	return nil
}

func archiveLegacyGTKFile(sourcePath, basePath string) (string, error) {
	data, err := os.ReadFile(sourcePath)
	if err != nil {
		return "", err
	}
	if !bytes.Contains(data, []byte(legacyGTKMarker)) {
		return "", fmt.Errorf("stylesheet changed during retirement")
	}
	info, err := os.Stat(sourcePath)
	if err != nil {
		return "", err
	}
	return writeLegacyGTKFileExclusive(basePath, data, info.Mode().Perm())
}

func writeLegacyGTKFileExclusive(basePath string, data []byte, mode os.FileMode) (string, error) {
	for i := 0; ; i++ {
		candidate := basePath
		if i > 0 {
			candidate = fmt.Sprintf("%s.%d", basePath, i)
		}
		file, err := os.OpenFile(candidate, os.O_WRONLY|os.O_CREATE|os.O_EXCL, mode)
		if os.IsExist(err) {
			continue
		}
		if err != nil {
			return "", err
		}
		if _, err := file.Write(data); err != nil {
			file.Close()
			os.Remove(candidate)
			return "", err
		}
		if err := file.Sync(); err != nil {
			file.Close()
			os.Remove(candidate)
			return "", err
		}
		if err := file.Close(); err != nil {
			os.Remove(candidate)
			return "", err
		}
		return candidate, nil
	}
}

func createLegacyGTKSymlink(target, basePath string) (string, error) {
	for i := 0; ; i++ {
		candidate := basePath
		if i > 0 {
			candidate = fmt.Sprintf("%s.%d", basePath, i)
		}
		if err := os.Symlink(target, candidate); os.IsExist(err) {
			continue
		} else if err != nil {
			return "", err
		}
		return candidate, nil
	}
}

func prepareLegacyGTKReplacement(sourcePath, destinationPath string) (string, error) {
	info, err := os.Lstat(sourcePath)
	if err != nil {
		return "", err
	}
	if !info.Mode().IsRegular() {
		return "", fmt.Errorf("backup is not a regular file")
	}

	source, err := os.Open(sourcePath)
	if err != nil {
		return "", err
	}
	defer source.Close()

	temp, err := os.CreateTemp(filepath.Dir(destinationPath), ".aether-gtk-restore-*")
	if err != nil {
		return "", err
	}
	tempPath := temp.Name()
	cleanUp := func() {
		temp.Close()
		os.Remove(tempPath)
	}
	if err := temp.Chmod(info.Mode().Perm()); err != nil {
		cleanUp()
		return "", err
	}
	if _, err := io.Copy(temp, source); err != nil {
		cleanUp()
		return "", err
	}
	if err := temp.Sync(); err != nil {
		cleanUp()
		return "", err
	}
	if err := temp.Close(); err != nil {
		os.Remove(tempPath)
		return "", err
	}

	regular, owned, err := inspectLegacyGTKStylesheet(tempPath, false)
	if err != nil {
		os.Remove(tempPath)
		return "", err
	}
	if !regular || owned {
		os.Remove(tempPath)
		return "", fmt.Errorf("backup changed during retirement")
	}
	return tempPath, nil
}
