import GLib from 'gi://GLib';
import Gio from 'gi://Gio';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import Gdk from 'gi://Gdk?version=4.0';

import { wallhavenService } from '../services/wallhaven-service.js';

export const WallpaperBrowser = GObject.registerClass({
    Signals: {
        'wallpaper-selected': { param_types: [GObject.TYPE_STRING] },
    },
}, class WallpaperBrowser extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
        });

        this._currentPage = 1;
        this._totalPages = 1;
        this._searchParams = {
            q: '',
            categories: '111', // All categories
            purity: '100', // SFW only
            sorting: 'date_added',
            order: 'desc',
        };

        this._loadApiKey();
        this._initializeUI();
        this._loadInitialWallpapers();
    }

    _initializeUI() {
        // Search and filters section
        const searchBox = this._createSearchSection();
        this.append(searchBox);

        // Scrolled window for wallpaper grid
        const scrolledWindow = new Gtk.ScrolledWindow({
            vexpand: true,
            hscrollbar_policy: Gtk.PolicyType.NEVER,
            vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
        });

        // Main content box with loading state
        this._contentStack = new Gtk.Stack({
            vexpand: true,
            transition_type: Gtk.StackTransitionType.CROSSFADE,
        });

        // Loading spinner
        const loadingBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER,
            spacing: 12,
        });
        const spinner = new Gtk.Spinner({
            width_request: 48,
            height_request: 48,
        });
        spinner.start();
        const loadingLabel = new Gtk.Label({
            label: 'Loading wallpapers...',
            css_classes: ['dim-label'],
        });
        loadingBox.append(spinner);
        loadingBox.append(loadingLabel);
        this._contentStack.add_named(loadingBox, 'loading');

        // Error state
        const errorBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            valign: Gtk.Align.CENTER,
            halign: Gtk.Align.CENTER,
            spacing: 12,
        });
        this._errorLabel = new Gtk.Label({
            label: 'Failed to load wallpapers',
            css_classes: ['error'],
        });
        const retryButton = new Gtk.Button({
            label: 'Retry',
        });
        retryButton.connect('clicked', () => this._performSearch());
        errorBox.append(this._errorLabel);
        errorBox.append(retryButton);
        this._contentStack.add_named(errorBox, 'error');

        // Wallpaper grid
        this._gridFlow = new Gtk.FlowBox({
            valign: Gtk.Align.START,
            max_children_per_line: 3,
            min_children_per_line: 2,
            selection_mode: Gtk.SelectionMode.NONE,
            column_spacing: 12,
            row_spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
            homogeneous: true,
        });

        scrolledWindow.set_child(this._gridFlow);
        this._contentStack.add_named(scrolledWindow, 'content');

        this._contentStack.set_visible_child_name('loading');
        this.append(this._contentStack);

        // Pagination controls
        const paginationBox = this._createPaginationControls();
        this.append(paginationBox);
    }

    _createSearchSection() {
        const searchGroup = new Adw.PreferencesGroup();

        // Search entry row
        const searchRow = new Adw.ActionRow({
            title: 'Search Wallpapers',
        });

        const searchEntry = new Gtk.SearchEntry({
            placeholder_text: 'Search by tags, colors...',
            valign: Gtk.Align.CENTER,
            hexpand: true,
        });

        searchEntry.connect('activate', () => {
            this._searchParams.q = searchEntry.get_text();
            this._currentPage = 1;
            this._performSearch();
        });

        const searchButton = new Gtk.Button({
            icon_name: 'system-search-symbolic',
            valign: Gtk.Align.CENTER,
        });
        searchButton.connect('clicked', () => {
            this._searchParams.q = searchEntry.get_text();
            this._currentPage = 1;
            this._performSearch();
        });

        searchRow.add_suffix(searchEntry);
        searchRow.add_suffix(searchButton);
        searchGroup.add(searchRow);

        // Sorting row
        const sortRow = new Adw.ComboRow({
            title: 'Sort By',
        });

        const sortModel = new Gtk.StringList();
        sortModel.append('Latest');
        sortModel.append('Relevance');
        sortModel.append('Random');
        sortModel.append('Views');
        sortModel.append('Favorites');
        sortModel.append('Top List');

        sortRow.set_model(sortModel);
        sortRow.set_selected(0);

        sortRow.connect('notify::selected', () => {
            const sortMethods = ['date_added', 'relevance', 'random', 'views', 'favorites', 'toplist'];
            this._searchParams.sorting = sortMethods[sortRow.get_selected()];
            this._currentPage = 1;
            this._performSearch();
        });

        searchGroup.add(sortRow);

        // Categories row
        const categoriesRow = new Adw.ActionRow({
            title: 'Categories',
            subtitle: 'Select wallpaper categories',
        });

        const categoriesBox = new Gtk.Box({
            spacing: 6,
            valign: Gtk.Align.CENTER,
        });

        const generalCheck = new Gtk.CheckButton({
            label: 'General',
            active: true,
        });
        const animeCheck = new Gtk.CheckButton({
            label: 'Anime',
            active: true,
        });
        const peopleCheck = new Gtk.CheckButton({
            label: 'People',
            active: true,
        });

        const updateCategories = () => {
            const cats = [
                generalCheck.get_active() ? '1' : '0',
                animeCheck.get_active() ? '1' : '0',
                peopleCheck.get_active() ? '1' : '0',
            ].join('');
            this._searchParams.categories = cats;
            this._currentPage = 1;
            this._performSearch();
        };

        generalCheck.connect('toggled', updateCategories);
        animeCheck.connect('toggled', updateCategories);
        peopleCheck.connect('toggled', updateCategories);

        categoriesBox.append(generalCheck);
        categoriesBox.append(animeCheck);
        categoriesBox.append(peopleCheck);

        categoriesRow.add_suffix(categoriesBox);
        searchGroup.add(categoriesRow);

        return searchGroup;
    }

    _createPaginationControls() {
        const paginationBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            halign: Gtk.Align.CENTER,
            spacing: 12,
            margin_top: 6,
            margin_bottom: 6,
        });

        this._prevButton = new Gtk.Button({
            icon_name: 'go-previous-symbolic',
            sensitive: false,
        });
        this._prevButton.connect('clicked', () => {
            if (this._currentPage > 1) {
                this._currentPage--;
                this._performSearch();
            }
        });

        this._pageLabel = new Gtk.Label({
            label: 'Page 1 of 1',
        });

        this._nextButton = new Gtk.Button({
            icon_name: 'go-next-symbolic',
            sensitive: false,
        });
        this._nextButton.connect('clicked', () => {
            if (this._currentPage < this._totalPages) {
                this._currentPage++;
                this._performSearch();
            }
        });

        paginationBox.append(this._prevButton);
        paginationBox.append(this._pageLabel);
        paginationBox.append(this._nextButton);

        return paginationBox;
    }

    _loadInitialWallpapers() {
        this._performSearch();
    }

    async _performSearch() {
        this._contentStack.set_visible_child_name('loading');

        try {
            const params = {
                ...this._searchParams,
                page: this._currentPage,
            };

            const result = await wallhavenService.search(params);

            if (result.data && result.data.length > 0) {
                this._displayWallpapers(result.data);
                this._updatePagination(result.meta);
                this._contentStack.set_visible_child_name('content');
            } else {
                this._showError('No wallpapers found');
            }
        } catch (e) {
            console.error('Search failed:', e.message);
            this._showError(`Failed to load wallpapers: ${e.message}`);
        }
    }

    _displayWallpapers(wallpapers) {
        // Clear existing items
        let child = this._gridFlow.get_first_child();
        while (child) {
            const next = child.get_next_sibling();
            this._gridFlow.remove(child);
            child = next;
        }

        // Add wallpaper thumbnails
        wallpapers.forEach(wallpaper => {
            const item = this._createWallpaperItem(wallpaper);
            this._gridFlow.append(item);
        });
    }

    _createWallpaperItem(wallpaper) {
        const button = new Gtk.Button({
            css_classes: ['flat'],
            overflow: Gtk.Overflow.HIDDEN,
        });

        const box = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
        });

        // Thumbnail image
        const picture = new Gtk.Picture({
            width_request: 280,
            height_request: 180,
            can_shrink: true,
            css_classes: ['card'],
        });

        // Load thumbnail asynchronously
        this._loadThumbnail(wallpaper.thumbs.small, picture);

        // Info label
        const infoLabel = new Gtk.Label({
            label: `${wallpaper.resolution} • ${this._formatFileSize(wallpaper.file_size)}`,
            css_classes: ['caption', 'dim-label'],
            xalign: 0,
        });

        box.append(picture);
        box.append(infoLabel);
        button.set_child(box);

        // Click handler to download and use wallpaper
        button.connect('clicked', () => {
            this._downloadAndUseWallpaper(wallpaper);
        });

        return button;
    }

    async _loadThumbnail(url, picture) {
        try {
            const cacheDir = GLib.build_filenamev([
                GLib.get_user_cache_dir(),
                'aether',
                'wallhaven-thumbs'
            ]);

            // Create cache directory if it doesn't exist
            GLib.mkdir_with_parents(cacheDir, 0o755);

            // Generate cache filename from URL
            const filename = url.split('/').pop();
            const cachePath = GLib.build_filenamev([cacheDir, filename]);

            // Check if already cached
            const file = Gio.File.new_for_path(cachePath);
            if (file.query_exists(null)) {
                picture.set_file(file);
                return;
            }

            // Download to cache
            await wallhavenService.downloadWallpaper(url, cachePath);
            picture.set_file(Gio.File.new_for_path(cachePath));
        } catch (e) {
            console.error('Failed to load thumbnail:', e.message);
        }
    }

    async _downloadAndUseWallpaper(wallpaper) {
        try {
            // Show loading state
            const toast = new Adw.Toast({
                title: 'Downloading wallpaper...',
                timeout: 0,
            });

            const toastOverlay = this._findToastOverlay();
            if (toastOverlay) {
                toastOverlay.add_toast(toast);
            }

            // Download wallpaper to cache
            const cacheDir = GLib.build_filenamev([
                GLib.get_user_cache_dir(),
                'aether',
                'wallhaven-wallpapers'
            ]);

            GLib.mkdir_with_parents(cacheDir, 0o755);

            const filename = wallpaper.path.split('/').pop();
            const wallpaperPath = GLib.build_filenamev([cacheDir, filename]);

            await wallhavenService.downloadWallpaper(wallpaper.path, wallpaperPath);

            // Emit signal with wallpaper path
            this.emit('wallpaper-selected', wallpaperPath);

            // Update toast
            if (toastOverlay) {
                const successToast = new Adw.Toast({
                    title: 'Wallpaper downloaded successfully',
                    timeout: 2,
                });
                toastOverlay.add_toast(successToast);
            }
        } catch (e) {
            console.error('Failed to download wallpaper:', e.message);

            const toastOverlay = this._findToastOverlay();
            if (toastOverlay) {
                const errorToast = new Adw.Toast({
                    title: `Download failed: ${e.message}`,
                    timeout: 3,
                });
                toastOverlay.add_toast(errorToast);
            }
        }
    }

    _findToastOverlay() {
        // Try to find the toast overlay in the window hierarchy
        let widget = this.get_parent();
        while (widget) {
            if (widget instanceof Adw.ToastOverlay) {
                return widget;
            }
            if (widget instanceof Adw.ApplicationWindow) {
                // If we reach the window, we can wrap our content in a toast overlay
                break;
            }
            widget = widget.get_parent();
        }
        return null;
    }

    _updatePagination(meta) {
        this._totalPages = meta.last_page || 1;
        this._pageLabel.set_label(`Page ${this._currentPage} of ${this._totalPages}`);

        this._prevButton.set_sensitive(this._currentPage > 1);
        this._nextButton.set_sensitive(this._currentPage < this._totalPages);
    }

    _showError(message) {
        this._errorLabel.set_label(message);
        this._contentStack.set_visible_child_name('error');
    }

    _formatFileSize(bytes) {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    }

    _loadApiKey() {
        try {
            const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'aether']);
            const configPath = GLib.build_filenamev([configDir, 'wallhaven.json']);
            const file = Gio.File.new_for_path(configPath);

            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(contents);
                    const config = JSON.parse(text);

                    if (config.apiKey) {
                        wallhavenService.setApiKey(config.apiKey);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load API key:', e.message);
        }
    }

    _saveApiKey(apiKey) {
        try {
            const configDir = GLib.build_filenamev([GLib.get_user_config_dir(), 'aether']);
            GLib.mkdir_with_parents(configDir, 0o755);

            const configPath = GLib.build_filenamev([configDir, 'wallhaven.json']);
            const config = { apiKey };

            const file = Gio.File.new_for_path(configPath);
            const contents = JSON.stringify(config, null, 2);

            file.replace_contents(
                contents,
                null,
                false,
                Gio.FileCreateFlags.REPLACE_DESTINATION,
                null
            );

            wallhavenService.setApiKey(apiKey);
        } catch (e) {
            console.error('Failed to save API key:', e.message);
            throw e;
        }
    }

    _showSettingsDialog() {
        const dialog = new Adw.Dialog({
            title: 'Wallhaven Settings',
            content_width: 400,
        });

        const toolbarView = new Adw.ToolbarView();

        const headerBar = new Adw.HeaderBar({
            show_title: true,
        });
        toolbarView.add_top_bar(headerBar);

        const contentBox = new Gtk.Box({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 12,
            margin_top: 12,
            margin_bottom: 12,
            margin_start: 12,
            margin_end: 12,
        });

        const prefsGroup = new Adw.PreferencesGroup({
            title: 'API Configuration',
            description: 'Configure your wallhaven.cc API key for access to additional content and higher rate limits',
        });

        // API Key entry
        const apiKeyRow = new Adw.EntryRow({
            title: 'API Key',
            show_apply_button: false,
        });

        // Load current API key if exists
        try {
            const configPath = GLib.build_filenamev([
                GLib.get_user_config_dir(),
                'aether',
                'wallhaven.json'
            ]);
            const file = Gio.File.new_for_path(configPath);
            if (file.query_exists(null)) {
                const [success, contents] = file.load_contents(null);
                if (success) {
                    const decoder = new TextDecoder('utf-8');
                    const text = decoder.decode(contents);
                    const config = JSON.parse(text);
                    if (config.apiKey) {
                        apiKeyRow.set_text(config.apiKey);
                    }
                }
            }
        } catch (e) {
            console.error('Failed to load current API key:', e.message);
        }

        prefsGroup.add(apiKeyRow);

        // Help text
        const helpLabel = new Gtk.Label({
            label: 'Get your API key from:\nhttps://wallhaven.cc/settings/account',
            wrap: true,
            xalign: 0,
            css_classes: ['dim-label', 'caption'],
        });

        contentBox.append(prefsGroup);
        contentBox.append(helpLabel);

        // Action buttons
        const buttonBox = new Gtk.Box({
            orientation: Gtk.Orientation.HORIZONTAL,
            spacing: 6,
            halign: Gtk.Align.END,
            margin_top: 12,
        });

        const cancelButton = new Gtk.Button({
            label: 'Cancel',
        });
        cancelButton.connect('clicked', () => dialog.close());

        const saveButton = new Gtk.Button({
            label: 'Save',
            css_classes: ['suggested-action'],
        });
        saveButton.connect('clicked', () => {
            const apiKey = apiKeyRow.get_text().trim();

            try {
                this._saveApiKey(apiKey);

                const toast = new Adw.Toast({
                    title: 'API key saved successfully',
                    timeout: 2,
                });

                const toastOverlay = this._findToastOverlay();
                if (toastOverlay) {
                    toastOverlay.add_toast(toast);
                }

                dialog.close();
            } catch (e) {
                const errorToast = new Adw.Toast({
                    title: `Failed to save API key: ${e.message}`,
                    timeout: 3,
                });

                const toastOverlay = this._findToastOverlay();
                if (toastOverlay) {
                    toastOverlay.add_toast(errorToast);
                }
            }
        });

        buttonBox.append(cancelButton);
        buttonBox.append(saveButton);
        contentBox.append(buttonBox);

        toolbarView.set_content(contentBox);
        dialog.set_child(toolbarView);

        dialog.present(this.get_root());
    }

    get widget() {
        return this;
    }
});
