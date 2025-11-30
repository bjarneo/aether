#!/bin/bash

config_file="$HOME/.config/cava/config"

if [ ! -f "$config_file" ]; then
    exit 0
fi

# Set theme = 'aether' in cava config
if ! grep -q "^theme = 'aether'" "$config_file"; then
    sed -i "/^theme = /d" "$config_file"
    sed -i "/^\[color\]/a theme = 'aether'" "$config_file"
fi

# Reload cava
pgrep -x cava && pkill -USR2 cava

