.PHONY: build dev test clean aether-wp install

UNAME_S := $(shell uname -s)

aether-wp:
ifeq ($(UNAME_S),Linux)
	go build -o build/bin/aether-wp ./cmd/aether-wp/
else
	@echo "aether-wp is Linux-only (requires GTK+, gtk-layer-shell, GStreamer), skipping"
endif

build:
ifeq ($(UNAME_S),Linux)
	$(MAKE) aether-wp
endif
	wails build

install: build
ifeq ($(UNAME_S),Darwin)
	cp build/bin/aether.app /Applications/Aether.app 2>/dev/null || \
		cp build/bin/aether /usr/local/bin/aether
else
	sudo cp build/bin/aether-wp /usr/bin/aether-wp
	sudo cp build/bin/aether /usr/bin/aether
endif

dev:
	wails dev

test:
	go test ./internal/... ./cli/...

clean:
	rm -rf build/bin
