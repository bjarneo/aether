#!/bin/bash

set -euo pipefail

source_dir="${AETHER_PLUGIN_SOURCE_DIR:-/usr/share/aether/omarchy-plugins}"
plugins_dir="${HOME}/.config/omarchy/plugins"
plugin_ids=(aether.wallpapers aether.blueprints)
plugin_sources=(wallpapers blueprints)
staging_path=""
backup_path=""
rollback_target=""

cleanup() {
    if [[ -n "$backup_path" && ( -e "$backup_path" || -L "$backup_path" ) \
        && -n "$rollback_target" && ! -e "$rollback_target" && ! -L "$rollback_target" ]]; then
        if mv "$backup_path" "$rollback_target"; then
            backup_path=""
        else
            echo "Could not restore plugin backup: $backup_path" >&2
        fi
    fi
    if [[ -n "$staging_path" && -d "$staging_path" ]]; then
        rm -rf "$staging_path"
    fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

command -v omarchy >/dev/null 2>&1 || {
    echo "Aether shell plugins require Omarchy." >&2
    exit 1
}
command -v aether >/dev/null 2>&1 || {
    echo "Aether shell plugins require the aether executable on PATH." >&2
    exit 1
}

for i in "${!plugin_ids[@]}"; do
    source_path="${source_dir}/${plugin_sources[$i]}"
    target_path="${plugins_dir}/${plugin_ids[$i]}"

    omarchy plugin validate "$source_path"
    if [[ -L "$target_path" || ( -e "$target_path" && ! -f "$target_path/.aether-managed" ) ]]; then
        echo "Refusing to replace unmanaged plugin directory: $target_path" >&2
        exit 1
    fi
done

mkdir -p "$plugins_dir"

for i in "${!plugin_ids[@]}"; do
    source_path="${source_dir}/${plugin_sources[$i]}"
    target_path="${plugins_dir}/${plugin_ids[$i]}"
    staging_path=$(mktemp -d "${plugins_dir}/.${plugin_ids[$i]}.XXXXXX")

    cp -R "${source_path}/." "$staging_path/"
    touch "$staging_path/.aether-managed"

    backup_path=""
    rollback_target="$target_path"
    if [[ -e "$target_path" || -L "$target_path" ]]; then
        backup_path=$(mktemp -d "${plugins_dir}/.${plugin_ids[$i]}.backup.XXXXXX")
        rmdir "$backup_path"
        mv "$target_path" "$backup_path"
    fi
    if ! mv "$staging_path" "$target_path"; then
        echo "Could not install plugin: ${plugin_ids[$i]}" >&2
        exit 1
    fi
    staging_path=""
    if [[ -n "$backup_path" ]]; then
        rm -rf "$backup_path"
        backup_path=""
    fi
    rollback_target=""
done

if omarchy-shell shell ping >/dev/null 2>&1; then
    omarchy-shell shell rescanPlugins >/dev/null
    for attempt in 1 2 3 4 5; do
        if omarchy plugin enable aether.wallpapers >/dev/null 2>&1 \
            && omarchy plugin enable aether.blueprints >/dev/null 2>&1; then
            echo "Installed and enabled Aether shell plugins."
            exit 0
        fi
        sleep 0.2
    done

    echo "Plugins installed, but Omarchy did not enable them. Run:" >&2
else
    echo "Plugins installed. Start omarchy-shell, then run:"
fi

echo "  omarchy-shell shell rescanPlugins"
echo "  omarchy plugin enable aether.wallpapers"
echo "  omarchy plugin enable aether.blueprints"
