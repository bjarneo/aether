# Theme Scheduler

Automatically switch themes at scheduled times via systemd.

## Setup

1. Open the **Scheduler** tab (alarm icon)
2. Enable **"Enable Scheduler"**
3. Click **"Add Schedule"**:
   - Set time (HH:MM)
   - Choose blueprint
   - Select days

## Example Schedules

| Time | Blueprint | Days |
|------|-----------|------|
| 08:00 | Light Theme | Weekdays |
| 18:00 | Dark Theme | Every day |
| 10:00 | High Contrast | Weekdays |

## CLI Commands

```bash
# Trigger schedule check manually
aether --check-schedule

# View logs
journalctl --user -u aether-scheduler.service -f
```

## How It Works

- Uses systemd user timer (checks every minute)
- Runs in background when Aether is closed
- Schedules stored in `~/.config/aether/schedules.json`
