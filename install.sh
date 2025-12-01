#!/bin/bash
#
# Aether Installer
# Installs Aether directly from AUR PKGBUILD
#
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/bjarneo/aether/main/install.sh | bash
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color
BOLD='\033[1m'

# AUR package details
AUR_PACKAGE="aether"
AUR_GIT_URL="https://aur.archlinux.org/${AUR_PACKAGE}.git"

print_header() {
    echo -e "${CYAN}"
    echo "╔══════════════════════════════════════════════════════════════╗"
    echo "║                                                              ║"
    echo "║        ░█████╗░███████╗████████╗██╗░░██╗███████╗██████╗░     ║"
    echo "║        ██╔══██╗██╔════╝╚══██╔══╝██║░░██║██╔════╝██╔══██╗     ║"
    echo "║        ███████║█████╗░░░░░██║░░░███████║█████╗░░██████╔╝     ║"
    echo "║        ██╔══██║██╔══╝░░░░░██║░░░██╔══██║██╔══╝░░██╔══██╗     ║"
    echo "║        ██║░░██║███████╗░░░██║░░░██║░░██║███████╗██║░░██║     ║"
    echo "║        ╚═╝░░╚═╝╚══════╝░░░╚═╝░░░╚═╝░░╚═╝╚══════╝╚═╝░░╚═╝     ║"
    echo "║                                                              ║"
    echo "║              Universal Desktop Synthesizer                   ║"
    echo "║                                                              ║"
    echo "╚══════════════════════════════════════════════════════════════╝"
    echo -e "${NC}"
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[✓]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

log_error() {
    echo -e "${RED}[✗]${NC} $1"
}

check_arch() {
    if ! command -v pacman &> /dev/null; then
        log_error "This installer requires Arch Linux (pacman not found)"
        exit 1
    fi
    log_success "Arch Linux detected"
}

check_dependencies() {
    log_info "Checking build dependencies..."

    local missing_deps=()

    if ! command -v git &> /dev/null; then
        missing_deps+=("git")
    fi

    if ! command -v makepkg &> /dev/null; then
        missing_deps+=("base-devel")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        log_warning "Missing dependencies: ${missing_deps[*]}"
        log_info "Installing missing dependencies..."
        if ! sudo pacman -S --needed --noconfirm "${missing_deps[@]}"; then
            log_error "Failed to install dependencies"
            exit 1
        fi
        log_success "Dependencies installed"
    else
        log_success "All build dependencies present"
    fi
}

install_from_aur() {
    local temp_dir
    temp_dir=$(mktemp -d)

    log_info "Created temporary directory: ${temp_dir}"

    # Cleanup on exit
    trap "rm -rf ${temp_dir}" EXIT

    log_info "Cloning AUR package: ${AUR_PACKAGE}..."
    if ! git clone --depth=1 "${AUR_GIT_URL}" "${temp_dir}/${AUR_PACKAGE}" 2>&1; then
        log_error "Failed to clone AUR package"
        exit 1
    fi
    log_success "AUR package cloned"

    cd "${temp_dir}/${AUR_PACKAGE}"

    # Show PKGBUILD info
    if [ -f "PKGBUILD" ]; then
        echo ""
        log_info "PKGBUILD contents:"
        echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
        cat PKGBUILD
        echo -e "${CYAN}────────────────────────────────────────────────────────────────${NC}"
        echo ""

        # Extract version info
        local pkgver
        pkgver=$(grep -E "^pkgver=" PKGBUILD | cut -d'=' -f2 | tr -d '"' | tr -d "'")
        if [ -n "$pkgver" ]; then
            log_info "Package version: ${BOLD}${pkgver}${NC}"
        fi
    fi

    echo ""
    log_info "Building and installing Aether..."
    echo -e "${YELLOW}This will prompt for your sudo password to install${NC}"
    echo ""

    # Build and install
    if ! makepkg -si --noconfirm; then
        log_error "Build failed"
        exit 1
    fi

    log_success "Aether installed successfully!"
}

print_post_install() {
    echo ""
    echo -e "${GREEN}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${GREEN}║                  Installation Complete!                      ║${NC}"
    echo -e "${GREEN}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    echo -e "${BOLD}Quick Start:${NC}"
    echo -e "  ${CYAN}aether${NC}                           # Launch GUI"
    echo -e "  ${CYAN}aether -w /path/to/wallpaper.jpg${NC} # Launch with wallpaper"
    echo -e "  ${CYAN}aether -g wallpaper.jpg${NC}          # CLI theme generation"
    echo -e "  ${CYAN}aether --widget-blueprint${NC}        # Floating widget mode"
    echo ""
    echo -e "${BOLD}Desktop Entry:${NC}"
    echo -e "  The desktop entry should be installed automatically."
    echo -e "  Search for 'Aether' in your application launcher."
    echo ""
    echo -e "${BOLD}Documentation:${NC}"
    echo -e "  ${CYAN}https://github.com/bjarneo/aether${NC}"
    echo ""
    echo -e "${BOLD}Community:${NC}"
    echo -e "  ${CYAN}https://aethr.no${NC}"
    echo ""
}

main() {
    print_header

    log_info "Starting Aether installation from AUR..."
    echo ""

    check_arch
    check_dependencies

    echo ""
    install_from_aur

    print_post_install
}

main "$@"
