.PHONY: build dev test clean aether-wp

aether-wp:
	go build -o build/bin/aether-wp ./cmd/aether-wp/

build: aether-wp
	wails build

dev:
	wails dev

test:
	go test ./internal/... ./cli/...

clean:
	rm -rf build/bin
