import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';

/**
 * TabNavigation - Custom tab navigation for Editor/Wallhaven/Local/Favorites
 * Provides styled toggle buttons with icons
 */
export const TabNavigation = GObject.registerClass(
    {
        Signals: {
            'tab-changed': {param_types: [GObject.TYPE_STRING]},
        },
    },
    class TabNavigation extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 0,
                css_classes: ['linked'],
                halign: Gtk.Align.END,
            });

            this._tabButtons = [];
            this._buildTabs();
        }

        _buildTabs() {
            // Editor tab button
            const editorBtn = new Gtk.ToggleButton({
                active: true,
            });
            const editorBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            editorBox.append(
                new Gtk.Image({
                    icon_name: 'edit-cover-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            editorBox.append(new Gtk.Label({label: 'Editor'}));
            editorBtn.set_child(editorBox);
            editorBtn.connect('clicked', () => {
                this._updateActiveButton(editorBtn);
                this.emit('tab-changed', 'editor');
            });
            this.append(editorBtn);
            this._tabButtons.push(editorBtn);

            // Visual separator
            const separator = new Gtk.Separator({
                orientation: Gtk.Orientation.VERTICAL,
            });
            this.append(separator);

            // Wallhaven tab button
            const wallhavenBtn = new Gtk.ToggleButton();
            const wallhavenBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            wallhavenBox.append(
                new Gtk.Image({
                    icon_name: 'system-search-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            wallhavenBox.append(new Gtk.Label({label: 'Wallhaven'}));
            wallhavenBtn.set_child(wallhavenBox);
            wallhavenBtn.connect('clicked', () => {
                this._updateActiveButton(wallhavenBtn);
                this.emit('tab-changed', 'wallhaven');
            });
            this.append(wallhavenBtn);
            this._tabButtons.push(wallhavenBtn);

            // Local tab button
            const localBtn = new Gtk.ToggleButton();
            const localBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            localBox.append(
                new Gtk.Image({
                    icon_name: 'wallpaper-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            localBox.append(new Gtk.Label({label: 'Local'}));
            localBtn.set_child(localBox);
            localBtn.connect('clicked', () => {
                this._updateActiveButton(localBtn);
                this.emit('tab-changed', 'local');
            });
            this.append(localBtn);
            this._tabButtons.push(localBtn);

            // Favorites tab button
            const favBtn = new Gtk.ToggleButton();
            const favBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 6,
            });
            favBox.append(
                new Gtk.Image({
                    icon_name: 'emblem-favorite-symbolic',
                    icon_size: Gtk.IconSize.NORMAL,
                })
            );
            favBox.append(new Gtk.Label({label: 'Favorites'}));
            favBtn.set_child(favBox);
            favBtn.connect('clicked', () => {
                this._updateActiveButton(favBtn);
                this.emit('tab-changed', 'favorites');
            });
            this.append(favBtn);
            this._tabButtons.push(favBtn);
        }

        _updateActiveButton(activeButton) {
            this._tabButtons.forEach(btn => {
                if (btn !== activeButton) {
                    btn.set_active(false);
                }
            });
        }

        setActiveTab(tabName) {
            const tabIndex = {
                editor: 0,
                wallhaven: 1,
                local: 2,
                favorites: 3,
            }[tabName];

            if (tabIndex !== undefined) {
                this._updateActiveButton(this._tabButtons[tabIndex]);
                this._tabButtons[tabIndex].set_active(true);
            }
        }
    }
);
