import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';

import {WallpaperBrowser} from './WallpaperBrowser.js';
import {LocalWallpaperBrowser} from './LocalWallpaperBrowser.js';
import {FavoritesView} from './FavoritesView.js';

export const WallpaperBrowserTabs = GObject.registerClass(
    {
        Signals: {
            'wallpaper-selected': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class WallpaperBrowserTabs extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this._initializeUI();
        }

        _initializeUI() {
            // View stack for tabs
            this._viewStack = new Adw.ViewStack();

            // Tab 1: Wallhaven browser
            this._wallhavenBrowser = new WallpaperBrowser();
            this._wallhavenBrowser.connect('wallpaper-selected', (_, path) => {
                this.emit('wallpaper-selected', path);
            });
            this._wallhavenBrowser.connect('favorites-changed', () => {
                // Reload favorites when wallhaven favorites change
                this._favoritesView.loadFavorites();
            });
            const wallhavenPage = this._viewStack.add_titled(
                this._wallhavenBrowser,
                'wallhaven',
                'Wallhaven'
            );
            wallhavenPage.set_icon_name('network-workgroup-symbolic');

            // Tab 2: Local wallpapers
            this._localBrowser = new LocalWallpaperBrowser();
            this._localBrowser.connect('wallpaper-selected', (_, path) => {
                this.emit('wallpaper-selected', path);
            });
            this._localBrowser.connect('favorites-changed', () => {
                // Reload favorites when local favorites change
                this._favoritesView.loadFavorites();
            });
            const localPage = this._viewStack.add_titled(
                this._localBrowser,
                'local',
                'Local'
            );
            localPage.set_icon_name('folder-symbolic');

            // Tab 3: Favorites (shared between local and wallhaven)
            this._favoritesView = new FavoritesView();
            this._favoritesView.connect('wallpaper-selected', (_, path) => {
                this.emit('wallpaper-selected', path);
            });
            const favoritesPage = this._viewStack.add_titled(
                this._favoritesView,
                'favorites',
                'Favorites'
            );
            favoritesPage.set_icon_name('emblem-favorite-symbolic');

            // Set Wallhaven as default tab
            this._viewStack.set_visible_child_name('wallhaven');

            // Monitor tab changes to reload favorites
            this._viewStack.connect('notify::visible-child-name', () => {
                if (this._viewStack.get_visible_child_name() === 'favorites') {
                    this._favoritesView.loadFavorites();
                }
            });

            // View switcher title for header
            const viewSwitcherTitle = new Adw.ViewSwitcherTitle();
            viewSwitcherTitle.set_stack(this._viewStack);

            this.append(viewSwitcherTitle);
            this.append(this._viewStack);
        }
    }
);
