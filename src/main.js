#!/usr/bin/env gjs

import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import { PaletteGenerator } from './components/PaletteGenerator.js';
import { ColorSynthesizer } from './components/ColorSynthesizer.js';
import { BlueprintManager } from './components/BlueprintManager.js';
import { ConfigWriter } from './utils/ConfigWriter.js';

// Initialize Adwaita
Adw.init();

const AetherApplication = GObject.registerClass(
    class AetherApplication extends Adw.Application {
        _init() {
            super._init({
                application_id: 'com.aether.DesktopSynthesizer',
                flags: Gio.ApplicationFlags.FLAGS_NONE,
            });
        }

        vfunc_activate() {
            let window = this.active_window;
            if (!window) {
                window = new AetherWindow(this);
            }
            window.present();
        }
    }
);

const AetherWindow = GObject.registerClass(
    class AetherWindow extends Adw.ApplicationWindow {
        _init(application) {
            super._init({
                application,
                title: 'Aether',
                default_width: 900,
                default_height: 700,
            });

            // Initialize config writer
            this.configWriter = new ConfigWriter();

        // Create header bar
        const headerBar = new Adw.HeaderBar();

        // Menu button for blueprints
        const menuButton = new Gtk.MenuButton({
            icon_name: 'open-menu-symbolic',
            tooltip_text: 'Main Menu',
        });
        headerBar.pack_end(menuButton);

        // Main container
        const toolbarView = new Adw.ToolbarView();
        toolbarView.add_top_bar(headerBar);

        // Create split view for compact layout
        const splitView = new Adw.NavigationSplitView({
            sidebar_width_fraction: 0.35,
            max_sidebar_width: 350,
        });

        // Sidebar - Blueprint Browser
        const sidebarPage = new Adw.NavigationPage({
            title: 'Blueprints',
        });

        const sidebarToolbarView = new Adw.ToolbarView();
        const sidebarHeader = new Adw.HeaderBar();
        sidebarHeader.set_show_end_title_buttons(false);
        sidebarToolbarView.add_top_bar(sidebarHeader);

        this.blueprintManager = new BlueprintManager();
        sidebarToolbarView.set_content(this.blueprintManager.widget);
        sidebarPage.set_child(sidebarToolbarView);
        splitView.set_sidebar(sidebarPage);

        // Main content - Color controls
        const contentPage = new Adw.NavigationPage({
            title: 'Synthesizer',
        });

        const scrolledWindow = new Gtk.ScrolledWindow({
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
            vexpand: true,
        });

        const clamp = new Adw.Clamp({
            maximum_size: 800,
            tightening_threshold: 600,
        });

        const mainBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 24,
            margin_top: 24,
            margin_bottom: 24,
            margin_start: 24,
            margin_end: 24,
        });

        // Generative Palette Section
        const paletteGroup = new Adw.PreferencesGroup({
            title: 'Generative Palette',
            description: 'Extract colors from your wallpaper',
            margin_bottom: 6,
        });

        this.paletteGenerator = new PaletteGenerator();
        paletteGroup.add(this.paletteGenerator.widget);

        // Color Synthesizer (hidden, only used for data storage)
        this.colorSynthesizer = new ColorSynthesizer();

        // Action bar at bottom
        const actionBar = new Gtk.ActionBar({
            margin_top: 12,
            margin_bottom: 8,
            margin_start: 12,
            margin_end: 12,
        });

        const applyButton = new Gtk.Button({
            label: 'Apply Theme',
            css_classes: ['suggested-action', 'pill'],
        });
        applyButton.connect('clicked', () => this.applyCurrentTheme());
        actionBar.pack_end(applyButton);

        const saveButton = new Gtk.Button({
            label: 'Save Blueprint',
            css_classes: ['pill'],
        });
        saveButton.connect('clicked', () => this.saveBlueprint());
        actionBar.pack_end(saveButton);

        mainBox.append(paletteGroup);

        clamp.set_child(mainBox);
        scrolledWindow.set_child(clamp);

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
        });
        contentBox.append(scrolledWindow);
        contentBox.append(actionBar);

        contentPage.set_child(contentBox);
        splitView.set_content(contentPage);

        toolbarView.set_content(splitView);
        this.set_content(toolbarView);

        // Connect signals
        this.paletteGenerator.connect('palette-generated', (_, colors) => {
            this.colorSynthesizer.setPalette(colors);
        });

        this.colorSynthesizer.connect('color-changed', (_, role, color) => {
            // Colors changed - user can click "Apply Theme" when ready
        });
    }

    applyCurrentTheme() {
        try {
            const colors = this.colorSynthesizer.getColors();
            const palette = this.paletteGenerator.getPalette();

            this.configWriter.applyTheme(colors, palette.wallpaper);
        } catch (e) {
            console.error(`Error applying theme: ${e.message}`);
        }
    }

    saveBlueprint() {
        const blueprint = {
            palette: this.paletteGenerator.getPalette(),
            colors: this.colorSynthesizer.getColors(),
            timestamp: Date.now(),
        };

        this.blueprintManager.saveBlueprint(blueprint);
    }
});

// Run the application
const app = new AetherApplication();
app.run([]);
