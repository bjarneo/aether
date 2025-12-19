import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import {SPACING} from '../constants/ui-constants.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const ScheduleDialog = GObject.registerClass(
    {
        GTypeName: 'ScheduleDialog',
        Signals: {
            'schedule-saved': {
                param_types: [
                    GObject.TYPE_STRING, // time
                    GObject.TYPE_STRING, // blueprintName
                    GObject.TYPE_JSOBJECT, // days array
                ],
            },
        },
    },
    class ScheduleDialog extends Adw.Dialog {
        _init(schedule = null, availableBlueprints = []) {
            super._init({
                title: schedule ? 'Edit Schedule' : 'Add Schedule',
                content_width: 400,
                content_height: 500,
            });

            this._schedule = schedule;
            this._blueprints = availableBlueprints;
            this._initUI();
        }

        _initUI() {
            const toolbarView = new Adw.ToolbarView();
            const headerBar = new Adw.HeaderBar();

            const cancelButton = new Gtk.Button({label: 'Cancel'});
            cancelButton.connect('clicked', () => this.close());
            headerBar.pack_start(cancelButton);

            const saveButton = new Gtk.Button({
                label: this._schedule ? 'Save' : 'Add',
                css_classes: ['suggested-action'],
            });
            saveButton.connect('clicked', () => this._onSave());
            headerBar.pack_end(saveButton);

            toolbarView.add_top_bar(headerBar);

            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 24,
                margin_end: 24,
                spacing: 24,
            });

            this._createTimeGroup(content);
            this._createBlueprintGroup(content);
            this._createDaysGroup(content);

            toolbarView.set_content(content);
            this.set_child(toolbarView);
        }

        _createTimeGroup(parent) {
            const group = new Adw.PreferencesGroup({title: 'Time'});
            const row = new Adw.ActionRow({title: 'Schedule Time'});

            const box = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
                valign: Gtk.Align.CENTER,
            });

            const [hour, minute] = this._schedule
                ? this._schedule.time.split(':').map(Number)
                : [8, 0];

            this._hourSpin = this._createSpinButton(0, 23, hour);
            this._minuteSpin = this._createSpinButton(0, 59, minute);

            box.append(this._hourSpin);
            box.append(new Gtk.Label({label: ':', css_classes: ['title-2']}));
            box.append(this._minuteSpin);

            row.add_suffix(box);
            group.add(row);
            parent.append(group);
        }

        _createSpinButton(min, max, value) {
            const spin = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: min,
                    upper: max,
                    step_increment: 1,
                }),
                numeric: true,
                wrap: true,
                width_chars: 2,
            });
            spin.set_value(value);
            spin.connect('output', s => {
                s.set_text(String(s.get_value_as_int()).padStart(2, '0'));
                return true;
            });
            return spin;
        }

        _createBlueprintGroup(parent) {
            const group = new Adw.PreferencesGroup({title: 'Blueprint'});
            const names = this._blueprints.map(bp => bp.name);

            this._blueprintRow = new Adw.ComboRow({
                title: 'Theme Blueprint',
                model: Gtk.StringList.new(names),
            });

            if (this._schedule) {
                const index = names.indexOf(this._schedule.blueprintName);
                if (index >= 0) this._blueprintRow.set_selected(index);
            }

            group.add(this._blueprintRow);
            parent.append(group);
        }

        _createDaysGroup(parent) {
            const group = new Adw.PreferencesGroup({
                title: 'Days',
                description: 'Select which days this schedule should run',
            });

            // Quick Select Buttons
            const quickBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                margin_bottom: SPACING.MD,
                halign: Gtk.Align.CENTER,
            });

            const createQuickBtn = (label, onClick) => {
                const btn = new Gtk.Button({label, css_classes: ['pill']});
                btn.connect('clicked', onClick);
                quickBox.append(btn);
            };

            createQuickBtn('Every Day', () =>
                this._dayToggles.forEach(t => t.set_active(true))
            );
            createQuickBtn('Weekdays', () =>
                this._dayToggles.forEach((t, i) =>
                    t.set_active(i >= 1 && i <= 5)
                )
            );
            createQuickBtn('Weekends', () =>
                this._dayToggles.forEach((t, i) =>
                    t.set_active(i === 0 || i === 6)
                )
            );

            group.add(quickBox);

            // Day Toggles
            const daysBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
                halign: Gtk.Align.CENTER,
            });

            const existingDays = this._schedule?.days || [];
            this._dayToggles = [];

            DAY_NAMES.forEach((name, i) => {
                const toggle = new Gtk.ToggleButton({
                    label: name,
                    active:
                        existingDays.length === 0 || existingDays.includes(i),
                    css_classes: ['circular'],
                });
                this._dayToggles.push(toggle);
                daysBox.append(toggle);
            });

            group.add(daysBox);
            parent.append(group);
        }

        _onSave() {
            const names = this._blueprints.map(bp => bp.name);
            const selectedIndex = this._blueprintRow.get_selected();

            if (
                selectedIndex === Gtk.INVALID_LIST_POSITION ||
                names.length === 0
            ) {
                return; // Validate
            }

            const time = `${String(this._hourSpin.get_value_as_int()).padStart(2, '0')}:${String(this._minuteSpin.get_value_as_int()).padStart(2, '0')}`;
            const blueprintName = names[selectedIndex];

            const selectedDays = [];
            this._dayToggles.forEach((t, i) => {
                if (t.get_active()) selectedDays.push(i);
            });

            // If all days selected, treat as empty array (every day)
            const days = selectedDays.length === 7 ? [] : selectedDays;

            this.emit('schedule-saved', time, blueprintName, days);
            this.close();
        }
    }
);
