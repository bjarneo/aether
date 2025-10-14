/**
 * Template file name mappings
 * Maps template file names to standardized app names used throughout Aether
 */

export const TEMPLATE_APP_NAME_MAP = {
    'alacritty.toml': 'alacritty',
    'btop.theme': 'btop',
    'chromium.theme': 'chromium',
    'ghostty.conf': 'ghostty',
    'hyprland.conf': 'hyprland',
    'hyprlock.conf': 'hyprlock',
    'icons.theme': 'icons',
    'kitty.conf': 'kitty',
    'mako.ini': 'mako',
    'neovim.lua': 'neovim',
    'swayosd.css': 'swayosd',
    'vencord.theme.css': 'vencord',
    'walker.css': 'walker',
    'waybar.css': 'waybar',
    'wofi.css': 'wofi',
};

/**
 * Get app name from template file name
 * @param {string} fileName - Template file name (e.g., 'hyprland.conf')
 * @returns {string} - App name (e.g., 'hyprland')
 */
export function getAppNameFromFileName(fileName) {
    return TEMPLATE_APP_NAME_MAP[fileName] || fileName.split('.')[0];
}
