package main

import "embed"

//go:embed all:templates
var EmbeddedTemplates embed.FS
