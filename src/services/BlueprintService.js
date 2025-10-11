export class BlueprintService {
    constructor(blueprintManager) {
        this.blueprintManager = blueprintManager;
    }

    saveBlueprint(palette, settings, lightMode) {
        palette.lightMode = lightMode;

        const blueprint = {
            palette: palette,
            timestamp: Date.now(),
            settings: settings,
        };

        this.blueprintManager.saveBlueprint(blueprint);
    }

    loadBlueprint(
        blueprint,
        paletteGenerator,
        colorSynthesizer,
        settingsSidebar
    ) {
        try {
            console.log('Loading blueprint:', blueprint.name);

            // Reset adjustment sliders when loading a blueprint
            settingsSidebar.resetAdjustments();

            // Switch to custom tab for blueprint editing
            paletteGenerator.switchToCustomTab();

            // Load palette (colors, wallpaper, locks)
            if (blueprint.palette) {
                paletteGenerator.loadBlueprintPalette(blueprint.palette);

                // Sync light mode to sidebar
                if (blueprint.palette.lightMode !== undefined) {
                    settingsSidebar.setLightMode(blueprint.palette.lightMode);
                }

                // Auto-assign color roles from palette
                if (blueprint.palette.colors) {
                    colorSynthesizer.setPalette(blueprint.palette.colors);
                }
            }

            // Load settings (including Neovim theme selection)
            if (blueprint.settings) {
                if (blueprint.settings.selectedNeovimConfig !== undefined) {
                    settingsSidebar.setNeovimTheme(
                        blueprint.settings.selectedNeovimConfig
                    );
                }
            }
        } catch (e) {
            console.error(`Error loading blueprint: ${e.message}`);
        }
    }
}
