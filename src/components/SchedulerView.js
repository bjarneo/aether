import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import Gtk from 'gi://Gtk?version=4.0';
import Adw from 'gi://Adw?version=1';
import {schedulerService} from '../services/SchedulerService.js';
import {ScheduleDialog} from './ScheduleDialog.js';
import {applyCssToWidget} from '../utils/ui-helpers.js';
import {SPACING} from '../constants/ui-constants.js';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

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

            this.schedulerService = schedulerService;
            this._initUI();
            this._loadSchedules();
        }

        _initUI() {
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

            this._createHeaderSection(mainBox);
            this._createDaemonSection(mainBox);
            this._createSchedulesSection(mainBox);
            this._createAddButton(mainBox);

            clamp.set_child(mainBox);
            scrolled.set_child(clamp);
            this.append(scrolled);
        }

        _createHeaderSection(parent) {
            const headerBox = new Gtk.Box({
                orientation: Gtk.Orientation.VERTICAL,
                spacing: 4,
                margin_bottom: SPACING.MD,
            });

            const title = new Gtk.Label({
                label: 'SCHEDULER',
                xalign: 0,
            });
            applyCssToWidget(
                title,
                `
                label {
                    font-size: 13px;
                    font-weight: 700;
                    letter-spacing: 0.5px;
                    opacity: 0.7;
                }
            `
            );
            headerBox.append(title);

            const subtitle = new Gtk.Label({
                label: 'Automatically switch themes at scheduled times',
                xalign: 0,
            });
            applyCssToWidget(
                subtitle,
                `
                label {
                    font-size: 11px;
                    opacity: 0.5;
                }
            `
            );
            headerBox.append(subtitle);

            parent.append(headerBox);
        }

        _createDaemonSection(parent) {
            const group = new Adw.PreferencesGroup({
                title: 'Background Service',
                description:
                    'The scheduler runs in the background to apply themes at scheduled times',
            });

            this._daemonRow = new Adw.SwitchRow({
                title: 'Enable Scheduler',
                subtitle: 'Checking status...',
            });

            this._daemonRow.connect('notify::active', () =>
                this._onDaemonToggled()
            );
            group.add(this._daemonRow);

            this._nextChangeRow = new Adw.ActionRow({
                title: 'Next Theme Change',
                subtitle: 'None scheduled',
                icon_name: 'appointment-soon-symbolic',
            });
            group.add(this._nextChangeRow);

            parent.append(group);
            this._updateDaemonStatus();
        }

        _createSchedulesSection(parent) {
            this._schedulesGroup = new Adw.PreferencesGroup({
                title: 'Schedules',
                description: 'Add schedules to automatically change themes',
            });

            this._scheduleRows = [];

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
                margin_top: SPACING.MD,
            });

            const addButton = new Gtk.Button({
                label: 'Add Schedule',
                css_classes: ['suggested-action'],
            });

            const buttonContent = new Adw.ButtonContent({
                icon_name: 'list-add-symbolic',
                label: 'Add Schedule',
            });
            addButton.set_child(buttonContent);

            applyCssToWidget(
                addButton,
                `
                button {
                    border-radius: 0;
                    padding: 8px 16px;
                }
            `
            );

            addButton.connect('clicked', () => this._showAddScheduleDialog());

            buttonBox.append(addButton);
            parent.append(buttonBox);
        }

        _loadSchedules() {
            for (const row of this._scheduleRows) {
                this._schedulesGroup.remove(row);
            }
            this._scheduleRows = [];

            const schedules = this.schedulerService.loadSchedules();

            if (schedules.length === 0) {
                this._emptyRow.set_visible(true);
            } else {
                this._emptyRow.set_visible(false);
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

            const timeLabel = new Gtk.Label({
                label: schedule.time,
                css_classes: ['title-3', 'numeric'],
                valign: Gtk.Align.CENTER,
            });
            row.add_prefix(timeLabel);

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

            const editButton = this._createActionButton(
                'document-edit-symbolic',
                'Edit schedule',
                () => this._showEditScheduleDialog(schedule)
            );
            row.add_suffix(editButton);

            const deleteButton = this._createActionButton(
                'user-trash-symbolic',
                'Delete schedule',
                () => this._confirmDeleteSchedule(schedule),
                ['error']
            );
            row.add_suffix(deleteButton);

            const applyButton = this._createActionButton(
                'media-playback-start-symbolic',
                'Apply now',
                () => this._applyScheduleNow(schedule)
            );
            row.add_suffix(applyButton);

            this._schedulesGroup.add(row);
            this._scheduleRows.push(row);
        }

        _createActionButton(icon, tooltip, callback, classes = []) {
            const btn = new Gtk.Button({
                icon_name: icon,
                valign: Gtk.Align.CENTER,
                css_classes: ['flat', ...classes],
                tooltip_text: tooltip,
            });
            btn.connect('clicked', callback);
            return btn;
        }

        _formatScheduleSubtitle(schedule) {
            if (
                !schedule.days ||
                schedule.days.length === 0 ||
                schedule.days.length === 7
            ) {
                return 'Every day';
            }

            const weekdays = [1, 2, 3, 4, 5];
            const isWeekdays =
                schedule.days.length === 5 &&
                weekdays.every(d => schedule.days.includes(d));

            const weekends = [0, 6];
            const isWeekends =
                schedule.days.length === 2 &&
                weekends.every(d => schedule.days.includes(d));

            if (isWeekdays) return 'Weekdays';
            if (isWeekends) return 'Weekends';

            return schedule.days.map(d => DAY_NAMES[d]).join(', ');
        }

        _showAddScheduleDialog() {
            this._openDialog(null);
        }

        _showEditScheduleDialog(schedule) {
            this._openDialog(schedule);
        }

        _openDialog(schedule) {
            const blueprints = this.schedulerService.getAvailableBlueprints();
            const dialog = new ScheduleDialog(schedule, blueprints);

            dialog.connect('schedule-saved', (_, time, blueprintName, days) => {
                if (schedule) {
                    this.schedulerService.updateSchedule(schedule.id, {
                        time,
                        blueprintName,
                        days,
                    });
                } else {
                    this.schedulerService.addSchedule({
                        time,
                        blueprintName,
                        days,
                        enabled: true,
                    });
                }
                this._loadSchedules();
                this.emit('schedule-changed');
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

                const window = this.get_root();
                if (window && window.toastOverlay) {
                    window.toastOverlay.add_toast(
                        new Adw.Toast({
                            title: `Applied: ${schedule.blueprintName}`,
                            timeout: 2,
                        })
                    );
                }
            } catch (error) {
                console.error('Failed to apply schedule:', error.message);
            }
        }

        _updateDaemonStatus() {
            const status = this.schedulerService.getSchedulerStatus();

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
                    this._daemonRow.freeze_notify();
                    this._daemonRow.set_active(false);
                    this._daemonRow.thaw_notify();
                }
            } else {
                this.schedulerService.disableScheduler();
            }

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

        refresh() {
            this._loadSchedules();
            this._updateDaemonStatus();
        }
    }
);
