import GLib from 'gi://GLib';

export class ThemeExporter {
    constructor(configWriter, dialogManager) {
        this.configWriter = configWriter;
        this.dialogManager = dialogManager;
    }

    startExport() {
        this.dialogManager.showThemeNameDialog(themeName => {
            this._chooseExportDirectory(themeName);
        });
    }

    _chooseExportDirectory(themeName) {
        this.dialogManager.chooseExportDirectory(exportPath => {
            this._performExport(themeName, exportPath);
        });
    }

    _performExport(themeName, exportPath) {
        try {
            const themeDir = `omarchy-${themeName}-theme`;
            const fullPath = GLib.build_filenamev([exportPath, themeDir]);

            console.log(`Exporting theme to: ${fullPath}`);

            this.configWriter.exportTheme(
                this.colors,
                this.wallpaper,
                fullPath,
                themeName,
                this.settings,
                this.lightMode,
                this.appOverrides,
                this.additionalImages
            );

            this.dialogManager.showSuccessDialog(fullPath);
        } catch (e) {
            this.dialogManager.showErrorDialog(e.message);
        }
    }

    setThemeData(
        colors,
        wallpaper,
        settings,
        lightMode,
        appOverrides = {},
        additionalImages = []
    ) {
        this.colors = colors;
        this.wallpaper = wallpaper;
        this.settings = settings;
        this.lightMode = lightMode;
        this.appOverrides = appOverrides;
        this.additionalImages = additionalImages;
    }
}
