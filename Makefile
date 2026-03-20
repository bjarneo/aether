.PHONY: build dev test clean

build:
	wails build

dev:
	wails dev

test:
	go test ./internal/... ./cli/...

clean:
	rm -rf build/bin
