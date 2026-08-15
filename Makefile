.PHONY: build dev test clean install

WEBKIT_TAGS := $(shell pkg-config --exists webkit2gtk-4.0 2>/dev/null || echo "-tags webkit2_41")

build:
	wails build $(WEBKIT_TAGS)

install: build
ifeq ($(shell uname -s),Darwin)
	cp build/bin/aether.app /Applications/Aether.app 2>/dev/null || \
		cp build/bin/aether /usr/local/bin/aether
else
	sudo cp build/bin/aether /usr/bin/aether
	mkdir -p $(HOME)/.local/share/applications
	cp li.oever.aether.desktop $(HOME)/.local/share/applications/
	cp li.oever.aether.url-handler.desktop $(HOME)/.local/share/applications/
	mkdir -p $(HOME)/.local/share/icons/hicolor/512x512/apps
	cp assets/aether-icon-512.png $(HOME)/.local/share/icons/hicolor/512x512/apps/aether.png
	-update-desktop-database $(HOME)/.local/share/applications 2>/dev/null
	-gtk-update-icon-cache -f $(HOME)/.local/share/icons/hicolor 2>/dev/null
	-xdg-mime default li.oever.aether.url-handler.desktop x-scheme-handler/aether 2>/dev/null
endif

dev:
	wails dev $(WEBKIT_TAGS)

test:
	go test ./internal/... ./cli/...

clean:
	rm -rf build/bin
