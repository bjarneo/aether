.PHONY: build dev test clean aether-wp install

aether-wp:
	go build -o build/bin/aether-wp ./cmd/aether-wp/

build: aether-wp
	wails build

install: build
	sudo cp build/bin/aether-wp /usr/bin/aether-wp
	sudo cp build/bin/aether /usr/bin/aether

dev:
	wails dev

test:
	go test ./internal/... ./cli/...

clean:
	rm -rf build/bin
