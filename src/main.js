#!/usr/bin/env gjs

/**
 * main.js - Entry point for Aether desktop theming application
 *
 * Aether is a GTK/Libadwaita theming application for Omarchy that provides:
 * - Visual interface for creating and applying desktop themes
 * - ImageMagick-based color extraction from wallpapers
 * - Wallhaven.cc wallpaper browsing integration
 * - Template-based configuration generation for multiple applications
 * - Blueprint system for saving and loading themes
 * - CLI support for non-interactive theme management
 *
 * CLI Commands:
 * - --list-blueprints: List all saved themes
 * - --apply-blueprint NAME: Apply saved theme by name
 * - --generate PATH: Extract colors from wallpaper and apply theme
 * - --wallpaper PATH: Launch GUI with specific wallpaper
 *
 * @module main
 */

import Adw from 'gi://Adw?version=1';
import {AetherApplication} from './AetherApplication.js';

Adw.init();

// Run the application
const app = new AetherApplication();
app.run([imports.system.programInvocationName].concat(ARGV));
