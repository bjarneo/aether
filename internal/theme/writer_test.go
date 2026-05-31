package theme_test

import (
	"os"
	"strings"
	"testing"

	"aether/internal/template"
	"aether/internal/theme"
)

func TestTriadTemplateRendersAccentColor(t *testing.T) {
	if got := theme.GetAppNameFromFileName("triad.kdl"); got != "triad" {
		t.Fatalf("GetAppNameFromFileName(triad.kdl) = %q, want triad", got)
	}

	content, err := os.ReadFile("../../templates/triad.kdl")
	if err != nil {
		t.Fatalf("read triad template: %v", err)
	}

	rendered := template.ProcessTemplate(
		string(content),
		map[string]string{"accent": "#7fc8ff"},
	)

	if !strings.Contains(rendered, `accent-color "#7fc8ff"`) {
		t.Fatalf("rendered Triad template does not contain accent color:\n%s", rendered)
	}
	if strings.Contains(rendered, "{accent}") {
		t.Fatalf("rendered Triad template still has unresolved variable:\n%s", rendered)
	}
}

func TestZellijTemplateMapsToZellijApp(t *testing.T) {
	if got := theme.GetAppNameFromFileName("zellij.kdl"); got != "zellij" {
		t.Fatalf("GetAppNameFromFileName(zellij.kdl) = %q, want zellij", got)
	}
}
