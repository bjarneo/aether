import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import {SchedulerService} from '../services/SchedulerService.js';

/**
 * Day names for display
 */
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_NAMES_FULL = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
];

/**
 * SchedulerView - UI component for managing theme schedules
 * Allows users to set up automated theme changes at specific times
 */
export const SchedulerView = GObject.registerClass(
    {
        GTypeName: 'SchedulerView',
        Signals: {
            'schedule-changed': {},
        },
    },
    class SchedulerView extends Gtk.Box {
        _init() {
            super._init({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 0,
            });

            this.schedulerService = new SchedulerService();
            this._initUI();
            this._loadSchedules();
        }

        _initUI() {
            // Create scrolled window for content
            const scrolled = new Gtk.ScrolledWindow({
                hscrollbar_policy: Gtk.PolicyType.NEVER,
                vscrollbar_policy: Gtk.PolicyType.AUTOMATIC,
                vexpand: true,
            });

            const clamp = new Adw.Clamp({
                maximum_size: 700,
                tightening_threshold: 500,
            });

            const mainBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 24,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 16,
                margin_end: 16,
            });

            // Header section with title and status
            this._createHeaderSection(mainBox);

            // Daemon status and control section
            this._createDaemonSection(mainBox);

            // Schedules list section
            this._createSchedulesSection(mainBox);

            // Add schedule button
            this._createAddButton(mainBox);

            clamp.set_child(mainBox);
            scrolled.set_child(clamp);
            this.append(scrolled);
        }

        _createHeaderSection(parent) {
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 8,
            });

            const titleBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 12,
            });

            const icon = new Gtk.Image({
                icon_name: 'alarm-symbolic',
                pixel_size: 48,
                css_classes: ['accent'],
            });
            titleBox.append(icon);

            const textBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                valign: Gtk.Align.CENTER,
            });

            const title = new Gtk.Label({
                label: 'Theme Scheduler',
                css_classes: ['title-1'],
                xalign: 0,
            });
            textBox.append(title);

            const subtitle = new Gtk.Label({
                label: 'Automatically switch themes at scheduled times',
                css_classes: ['dim-label'],
                xalign: 0,
            });
            textBox.append(subtitle);

            titleBox.append(textBox);
            headerBox.append(titleBox);
            parent.append(headerBox);
        }

        _createDaemonSection(parent) {
            const group = new Adw.PreferencesGroup({
                title: 'Background Service',
                description:
                    'The scheduler runs in the background to apply themes at scheduled times',
            });

            // Daemon status row with toggle
            this._daemonRow = new Adw.SwitchRow({
                title: 'Enable Scheduler',
                subtitle: 'Checking status...',
            });

            this._daemonRow.connect('notify::active', () => {
                this._onDaemonToggled();
            });

            group.add(this._daemonRow);

            // Next scheduled change info
            this._nextChangeRow = new Adw.ActionRow({
                title: 'Next Theme Change',
                subtitle: 'None scheduled',
                icon_name: 'appointment-soon-symbolic',
            });
            group.add(this._nextChangeRow);

            parent.append(group);

            // Update daemon status
            this._updateDaemonStatus();
        }

        _createSchedulesSection(parent) {
            this._schedulesGroup = new Adw.PreferencesGroup({
                title: 'Schedules',
                description: 'Add schedules to automatically change themes',
            });

            // Track schedule rows for proper cleanup
            this._scheduleRows = [];

            // Placeholder for empty state
            this._emptyRow = new Adw.ActionRow({
                title: 'No schedules yet',
                subtitle: 'Click the button below to add your first schedule',
                icon_name: 'list-add-symbolic',
                css_classes: ['dim-label'],
            });
            this._schedulesGroup.add(this._emptyRow);

            parent.append(this._schedulesGroup);
        }

        _createAddButton(parent) {
            const buttonBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                halign: Gtk.Align.CENTER,
                margin_top: 12,
            });

            const addButton = new Gtk.Button({
                label: 'Add Schedule',
                css_classes: ['suggested-action', 'pill'],
            });
            addButton.set_child(
                new Adw.ButtonContent({
                    icon_name: 'list-add-symbolic',
                    label: 'Add Schedule',
                })
            );
            addButton.connect('clicked', () => this._showAddScheduleDialog());

            buttonBox.append(addButton);
            parent.append(buttonBox);
        }

        _loadSchedules() {
            // Clear existing schedule rows (tracked separately)
            for (const row of this._scheduleRows) {
                this._schedulesGroup.remove(row);
            }
            this._scheduleRows = [];

            const schedules = this.schedulerService.loadSchedules();

            if (schedules.length === 0) {
                this._emptyRow.set_visible(true);
            } else {
                this._emptyRow.set_visible(false);

                // Sort by time
                schedules.sort((a, b) => a.time.localeCompare(b.time));

                for (const schedule of schedules) {
                    this._addScheduleRow(schedule);
                }
            }

            this._updateNextChange();
        }

        _addScheduleRow(schedule) {
            const row = new Adw.ActionRow({
                title: schedule.blueprintName,
                subtitle: this._formatScheduleSubtitle(schedule),
            });

            // Time label
            const timeLabel = new Gtk.Label({
                label: schedule.time,
                css_classes: ['title-3', 'numeric'],
                valign: Gtk.Align.CENTER,
            });
            row.add_prefix(timeLabel);

            // Enable/disable switch
            const enableSwitch = new Gtk.Switch({
                active: schedule.enabled,
                valign: Gtk.Align.CENTER,
            });
            enableSwitch.connect('notify::active', () => {
                this.schedulerService.updateSchedule(schedule.id, {
                    enabled: enableSwitch.get_active(),
                });
                this._updateNextChange();
                this.emit('schedule-changed');
            });
            row.add_suffix(enableSwitch);

            // Edit button
            const editButton = new Gtk.Button({
                icon_name: 'document-edit-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat'],
                tooltip_text: 'Edit schedule',
            });
            editButton.connect('clicked', () =>
                this._showEditScheduleDialog(schedule)
            );
            row.add_suffix(editButton);

            // Delete button
            const deleteButton = new Gtk.Button({
                icon_name: 'user-trash-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', 'error'],
                tooltip_text: 'Delete schedule',
            });
            deleteButton.connect('clicked', () =>
                this._confirmDeleteSchedule(schedule)
            );
            row.add_suffix(deleteButton);

            // Apply now button
            const applyButton = new Gtk.Button({
                icon_name: 'media-playback-start-symbolic',
                valign: Gtk.Align.CENTER,
                css_classes: ['flat'],
                tooltip_text: 'Apply now',
            });
            applyButton.connect('clicked', () =>
                this._applyScheduleNow(schedule)
            );
            row.add_suffix(applyButton);

            this._schedulesGroup.add(row);
            this._scheduleRows.push(row);
        }

        _formatScheduleSubtitle(schedule) {
            if (!schedule.days || schedule.days.length === 0) {
                return 'Every day';
            }
            if (schedule.days.length === 7) {
                return 'Every day';
            }
            if (
                schedule.days.length === 5 &&
                schedule.days.includes(1) &&
                schedule.days.includes(2) &&
                schedule.days.includes(3) &&
                schedule.days.includes(4) &&
                schedule.days.includes(5)
            ) {
                return 'Weekdays';
            }
            if (
                schedule.days.length === 2 &&
                schedule.days.includes(0) &&
                schedule.days.includes(6)
            ) {
                return 'Weekends';
            }
            return schedule.days.map(d => DAY_NAMES[d]).join(', ');
        }

        _showAddScheduleDialog() {
            this._showScheduleDialog(null);
        }

        _showEditScheduleDialog(schedule) {
            this._showScheduleDialog(schedule);
        }

        _showScheduleDialog(existingSchedule) {
            const isEdit = existingSchedule !== null;
            const dialog = new Adw.Dialog({
                title: isEdit ? 'Edit Schedule' : 'Add Schedule',
                content_width: 400,
                content_height: 500,
            });

            const toolbarView = new Adw.ToolbarView();

            // Header bar
            const headerBar = new Adw.HeaderBar();

            const cancelButton = new Gtk.Button({label: 'Cancel'});
            cancelButton.connect('clicked', () => dialog.close());
            headerBar.pack_start(cancelButton);

            const saveButton = new Gtk.Button({
                label: isEdit ? 'Save' : 'Add',
                css_classes: ['suggested-action'],
            });
            headerBar.pack_end(saveButton);

            toolbarView.add_top_bar(headerBar);

            // Content
            const content = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                margin_top: 24,
                margin_bottom: 24,
                margin_start: 24,
                margin_end: 24,
                spacing: 24,
            });

            // Time picker group
            const timeGroup = new Adw.PreferencesGroup({
                title: 'Time',
            });

            // Hour and minute spin buttons
            const timeRow = new Adw.ActionRow({
                title: 'Schedule Time',
            });

            const timeBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
                valign: Gtk.Align.CENTER,
            });

            const hourSpin = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 23,
                    step_increment: 1,
                }),
                numeric: true,
                wrap: true,
                width_chars: 2,
            });
            hourSpin.set_value(
                existingSchedule
                    ? parseInt(existingSchedule.time.split(':')[0])
                    : 8
            );

            const colonLabel = new Gtk.Label({
                label: ':',
                css_classes: ['title-2'],
            });

            const minuteSpin = new Gtk.SpinButton({
                adjustment: new Gtk.Adjustment({
                    lower: 0,
                    upper: 59,
                    step_increment: 1,
                }),
                numeric: true,
                wrap: true,
                width_chars: 2,
            });
            minuteSpin.set_value(
                existingSchedule
                    ? parseInt(existingSchedule.time.split(':')[1])
                    : 0
            );

            // Format display
            hourSpin.connect('output', spin => {
                spin.set_text(String(spin.get_value_as_int()).padStart(2, '0'));
                return true;
            });
            minuteSpin.connect('output', spin => {
                spin.set_text(String(spin.get_value_as_int()).padStart(2, '0'));
                return true;
            });

            timeBox.append(hourSpin);
            timeBox.append(colonLabel);
            timeBox.append(minuteSpin);

            timeRow.add_suffix(timeBox);
            timeGroup.add(timeRow);
            content.append(timeGroup);

            // Blueprint picker group
            const blueprintGroup = new Adw.PreferencesGroup({
                title: 'Blueprint',
            });

            const blueprints = this.schedulerService.getAvailableBlueprints();
            const blueprintNames = blueprints.map(bp => bp.name);

            const blueprintRow = new Adw.ComboRow({
                title: 'Theme Blueprint',
                model: Gtk.StringList.new(blueprintNames),
            });

            // Set selected blueprint if editing
            if (existingSchedule) {
                const index = blueprintNames.indexOf(
                    existingSchedule.blueprintName
                );
                if (index >= 0) {
                    blueprintRow.set_selected(index);
                }
            }

            blueprintGroup.add(blueprintRow);
            content.append(blueprintGroup);

            // Days picker group
            const daysGroup = new Adw.PreferencesGroup({
                title: 'Days',
                description: 'Select which days this schedule should run',
            });

            // Quick select buttons
            const quickSelectBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 8,
                margin_bottom: 12,
                halign: Gtk.Align.CENTER,
            });

            const dayToggles = [];
            const existingDays = existingSchedule?.days || [];

            const everydayButton = new Gtk.Button({
                label: 'Every Day',
                css_classes: ['pill'],
            });
            const weekdaysButton = new Gtk.Button({
                label: 'Weekdays',
                css_classes: ['pill'],
            });
            const weekendsButton = new Gtk.Button({
                label: 'Weekends',
                css_classes: ['pill'],
            });

            quickSelectBox.append(everydayButton);
            quickSelectBox.append(weekdaysButton);
            quickSelectBox.append(weekendsButton);
            daysGroup.add(quickSelectBox);

            // Individual day toggles
            const daysBox = new Gtk.Box({
                orientation: Gtk.Orientation.HORIZONTAL,
                spacing: 4,
                halign: Gtk.Align.CENTER,
            });

            for (let i = 0; i < 7; i++) {
                const toggle = new Gtk.ToggleButton({
                    label: DAY_NAMES[i],
                    active:
                        existingDays.length === 0 || existingDays.includes(i),
                    css_classes: ['circular'],
                });
                dayToggles.push(toggle);
                daysBox.append(toggle);
            }

            daysGroup.add(daysBox);
            content.append(daysGroup);

            // Quick select button actions
            everydayButton.connect('clicked', () => {
                dayToggles.forEach(t => t.set_active(true));
            });
            weekdaysButton.connect('clicked', () => {
                dayToggles.forEach((t, i) => t.set_active(i >= 1 && i <= 5));
            });
            weekendsButton.connect('clicked', () => {
                dayToggles.forEach((t, i) => t.set_active(i === 0 || i === 6));
            });

            toolbarView.set_content(content);
            dialog.set_child(toolbarView);

            // Save action
            saveButton.connect('clicked', () => {
                const time = `${String(hourSpin.get_value_as_int()).padStart(2, '0')}:${String(minuteSpin.get_value_as_int()).padStart(2, '0')}`;

                const selectedBlueprintIndex = blueprintRow.get_selected();
                if (
                    selectedBlueprintIndex === Gtk.INVALID_LIST_POSITION ||
                    blueprintNames.length === 0
                ) {
                    // Show error toast or dialog
                    return;
                }
                const blueprintName = blueprintNames[selectedBlueprintIndex];

                // Get selected days
                const days = [];
                dayToggles.forEach((toggle, i) => {
                    if (toggle.get_active()) {
                        days.push(i);
                    }
                });

                // All days selected = empty array (every day)
                const finalDays = days.length === 7 ? [] : days;

                if (isEdit) {
                    this.schedulerService.updateSchedule(existingSchedule.id, {
                        time,
                        blueprintName,
                        days: finalDays,
                    });
                } else {
                    this.schedulerService.addSchedule({
                        time,
                        blueprintName,
                        days: finalDays,
                        enabled: true,
                    });
                }

                this._loadSchedules();
                this.emit('schedule-changed');
                dialog.close();
            });

            dialog.present(this.get_root());
        }

        _confirmDeleteSchedule(schedule) {
            const dialog = new Adw.MessageDialog({
                transient_for: this.get_root(),
                modal: true,
                heading: 'Delete Schedule?',
                body: `Delete the schedule for "${schedule.blueprintName}" at ${schedule.time}?`,
            });

            dialog.add_response('cancel', 'Cancel');
            dialog.add_response('delete', 'Delete');
            dialog.set_response_appearance(
                'delete',
                Adw.ResponseAppearance.DESTRUCTIVE
            );
            dialog.set_default_response('cancel');

            dialog.connect('response', (_, response) => {
                if (response === 'delete') {
                    this.schedulerService.deleteSchedule(schedule.id);
                    this._loadSchedules();
                    this.emit('schedule-changed');
                }
            });

            dialog.present();
        }

        _applyScheduleNow(schedule) {
            try {
                GLib.spawn_command_line_async(
                    `aether --apply-blueprint "${schedule.blueprintName}"`
                );

                // Show success feedback
                const toast = new Adw.Toast({
                    title: `Applied: ${schedule.blueprintName}`,
                    timeout: 2,
                });

                const window = this.get_root();
                if (window && window.toastOverlay) {
                    window.toastOverlay.add_toast(toast);
                }
            } catch (error) {
                console.error('Failed to apply schedule:', error.message);
            }
        }

        _updateDaemonStatus() {
            const status = this.schedulerService.getSchedulerStatus();

            // Temporarily disconnect signal to avoid triggering toggle
            this._daemonRow.freeze_notify();
            this._daemonRow.set_active(status.enabled);
            this._daemonRow.thaw_notify();

            if (status.enabled && status.active) {
                this._daemonRow.set_subtitle('Running in background');
            } else if (status.enabled) {
                this._daemonRow.set_subtitle('Enabled but not running');
            } else {
                this._daemonRow.set_subtitle('Not running');
            }
        }

        _onDaemonToggled() {
            const active = this._daemonRow.get_active();

            if (active) {
                const success = this.schedulerService.enableScheduler();
                if (!success) {
                    // Revert toggle on failure
                    this._daemonRow.freeze_notify();
                    this._daemonRow.set_active(false);
                    this._daemonRow.thaw_notify();
                }
            } else {
                this.schedulerService.disableScheduler();
            }

            // Update status after a brief delay
            GLib.timeout_add(GLib.PRIORITY_DEFAULT, 500, () => {
                this._updateDaemonStatus();
                return GLib.SOURCE_REMOVE;
            });
        }

        _updateNextChange() {
            const next = this.schedulerService.getNextScheduledChange();

            if (next) {
                const hours = Math.floor(next.minutesUntil / 60);
                const minutes = next.minutesUntil % 60;

                let timeStr;
                if (hours > 24) {
                    const days = Math.floor(hours / 24);
                    timeStr = `in ${days} day${days > 1 ? 's' : ''}`;
                } else if (hours > 0) {
                    timeStr = `in ${hours}h ${minutes}m`;
                } else {
                    timeStr = `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
                }

                this._nextChangeRow.set_subtitle(
                    `${next.blueprintName} at ${next.time} (${timeStr})`
                );
            } else {
                this._nextChangeRow.set_subtitle('No enabled schedules');
            }
        }

        /**
         * Refresh the view (called when switching to this tab)
         */
        refresh() {
            this._loadSchedules();
            this._updateDaemonStatus();
        }
    }
);
