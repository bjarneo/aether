package template

import (
	"embed"
	"io/fs"
	"path"
	"sort"
)

// ListTemplates returns all template file names from the embedded FS under dir.
// Only regular files are returned; directories (like vscode-extension/) are skipped.
// Results are sorted alphabetically.
func ListTemplates(fsys embed.FS, dir string) ([]string, error) {
	entries, err := fs.ReadDir(fsys, dir)
	if err != nil {
		return nil, err
	}

	var names []string
	for _, e := range entries {
		if e.IsDir() {
			continue
		}
		names = append(names, e.Name())
	}
	sort.Strings(names)
	return names, nil
}

// ReadTemplate reads a template file from the embedded FS under dir/name and
// returns its content as a string.
func ReadTemplate(fsys embed.FS, dir, name string) (string, error) {
	data, err := fs.ReadFile(fsys, path.Join(dir, name))
	if err != nil {
		return "", err
	}
	return string(data), nil
}
