#!/bin/bash
# Self-contained installer for Raspberry Pi 5 + Raspberry Pi OS labwc desktop.
set -Eeuo pipefail

usage() {
    cat <<'HELP'
Usage: sudo bash install-wakeuphere-pi.sh [--user DESKTOP_USER] [--reboot]
       sudo bash install-wakeuphere-pi.sh --check [--user DESKTOP_USER]
       bash install-wakeuphere-pi.sh --extract DIRECTORY

Installs SPI joystick control, desktop autologin and a full-screen WakeUpHere.
Requires Raspberry Pi 5, Raspberry Pi OS desktop (labwc/LightDM), and internet.
The default desktop user is SUDO_USER. Does not change hostname, credentials,
Wi-Fi, browser identity or audio device. Reboot is opt-in. --check is read-only.
--extract only writes embedded payload files; it never installs system settings.
HELP
}

payload() {
    mkdir -p "$1"
    cat > "$1/joystick.py" <<'PYTHON'
#!/usr/bin/python3
"""Pi 5 joystick: auto-detected RP1, MCP3008 SPI0/CE0, SW on BCM17."""
import argparse
import contextlib
import fcntl
import os
import re
import signal
import subprocess
import time


def detect_chip(output):
    matches = re.findall(r'^gpiochip(\d+)\s+\[pinctrl-rp1\]', output, re.MULTILINE)
    if len(matches) != 1:
        raise RuntimeError('Expected exactly one pinctrl-rp1 controller; run gpiodetect')
    return int(matches[0])


def direction(dx, dy, deadzone=220, invert_x=False, invert_y=False):
    dx = -dx if invert_x else dx
    dy = -dy if invert_y else dy
    if max(abs(dx), abs(dy)) <= deadzone:
        return None
    if abs(dx) >= abs(dy):
        return 'right' if dx > 0 else 'left'
    return 'down' if dy > 0 else 'up'


class DebouncedButton:
    def __init__(self, raw, now):
        self.raw = self.stable = raw
        self.changed = now

    def update(self, raw, now):
        if raw != self.raw:
            self.raw, self.changed = raw, now
        if self.stable != self.raw and now - self.changed >= 0.05:
            self.stable = self.raw
            return self.stable == 0
        return False


def main():
    import lgpio
    import spidev
    from evdev import UInput, ecodes as E

    parser = argparse.ArgumentParser()
    parser.add_argument('--diagnose', action='store_true', help='Print raw readings without keyboard events')
    args = parser.parse_args()
    def stop(*_):
        raise SystemExit(0)
    signal.signal(signal.SIGTERM, stop)

    with contextlib.ExitStack() as stack:
        lock = stack.enter_context(open('/run/lock/wakeuphere-joystick.lock', 'w'))
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise RuntimeError('Controller already running; stop wakeuphere-joystick first')
        chip = detect_chip(subprocess.check_output(['gpiodetect'], text=True))
        handle = lgpio.gpiochip_open(chip)
        stack.callback(lgpio.gpiochip_close, handle)
        lgpio.gpio_claim_input(handle, 17, lgpio.SET_PULL_UP)
        spi = spidev.SpiDev()
        spi.open(0, 0)
        stack.callback(spi.close)
        spi.max_speed_hz = 500_000

        def read(channel):
            result = spi.xfer2([1, (8 + channel) << 4, 0])
            return ((result[1] & 3) << 8) | result[2]

        if args.diagnose:
            print(f'RP1 gpiochip{chip}; X/Y: 0..1023; SW: released=1, pressed=0', flush=True)
            while True:
                print(f'X={read(0)} Y={read(1)} SW={lgpio.gpio_read(handle, 17)}', flush=True)
                time.sleep(0.25)

        print(f'RP1 gpiochip{chip}. Release joystick: calibrating...', flush=True)
        time.sleep(1)
        center_x = sum(read(0) for _ in range(30)) / 30
        center_y = sum(read(1) for _ in range(30)) / 30
        if not (250 < center_x < 775 and 250 < center_y < 775):
            raise RuntimeError(f'Unexpected center X={center_x:.0f}, Y={center_y:.0f}; release stick and check wiring')

        keys = {'left': E.KEY_LEFT, 'right': E.KEY_RIGHT,
                'up': E.KEY_UP, 'down': E.KEY_DOWN, 'space': E.KEY_SPACE}
        keyboard = stack.enter_context(UInput({E.EV_KEY: list(keys.values())}, name='WakeUpHere Joystick'))

        def tap(name):
            code = keys[name]
            keyboard.write(E.EV_KEY, code, 1)
            keyboard.syn()
            try:
                time.sleep(0.02)
            finally:
                keyboard.write(E.EV_KEY, code, 0)
                keyboard.syn()

        time.sleep(1)  # Allow the desktop to discover the virtual keyboard.
        print(f'Ready. Center X={center_x:.0f}, Y={center_y:.0f}', flush=True)
        button = DebouncedButton(lgpio.gpio_read(handle, 17), time.monotonic())
        invert_x = os.environ.get('INVERT_X', '0') == '1'
        invert_y = os.environ.get('INVERT_Y', '0') == '1'
        next_move = 0
        while True:
            now = time.monotonic()
            name = direction(read(0) - center_x, read(1) - center_y,
                             invert_x=invert_x, invert_y=invert_y)
            if name and now >= next_move:
                tap(name)
                next_move = now + 0.18
            if button.update(lgpio.gpio_read(handle, 17), now):
                tap('space')
            time.sleep(0.01)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
PYTHON

    cat > "$1/start-browser.sh" <<'BROWSER'
#!/bin/bash
set -eu
url='https://wakeupmap-globalversion.vercel.app/wakeuphere/'
mkdir -p "$HOME/.config/wakeuphere"
exec 9>"$HOME/.config/wakeuphere/browser.lock"
flock -n 9 || exit 0

while true; do
    # Maintenance: create this file, then Alt+F4 to keep the browser closed.
    while [ -f "$HOME/.config/wakeuphere/maintenance" ]; do sleep 5; done
    # Do not leave an offline error screen at startup; retry until online.
    until curl --silent --fail --location --connect-timeout 3 --max-time 10 \
        --output /dev/null "$url"; do
        if [ -f "$HOME/.config/wakeuphere/maintenance" ]; then break; fi
        sleep 5
    done
    [ ! -f "$HOME/.config/wakeuphere/maintenance" ] || continue
    chromium --user-data-dir="$HOME/.config/wakeuphere-chromium" \
        --password-store=basic --kiosk --no-first-run "$url" || true
    sleep 5
done
BROWSER

    cat > "$1/wakeuphere-joystick.service" <<'SERVICE'
[Unit]
Description=WakeUpHere Joystick Controller
After=systemd-modules-load.service
StartLimitIntervalSec=0

[Service]
Type=simple
User=root
WorkingDirectory=/opt/wakeuphere
EnvironmentFile=-/etc/default/wakeuphere-joystick
ExecStart=/usr/bin/python3 -u /opt/wakeuphere/joystick.py
Restart=on-failure
RestartSec=10
UMask=0022

[Install]
WantedBy=multi-user.target
SERVICE

    cat > "$1/configure.py" <<'CONFIGURE'
"""Render a managed autostart section, preserving unrelated user settings."""
import pathlib
import sys

START = '# BEGIN WAKEUPHERE MANAGED'
END = '# END WAKEUPHERE MANAGED'


def autostart(existing, home):
    lines, managed = [], False
    legacy = f'{home}/wakeuphere/start-browser.sh'
    for line in existing.splitlines():
        if line.strip() == START:
            if managed:
                raise ValueError('Nested managed autostart section')
            managed = True
            continue
        if line.strip() == END:
            if not managed:
                raise ValueError('Unexpected managed section end')
            managed = False
            continue
        if managed:
            continue
        if line.strip() in (legacy + ' &', '"' + legacy + '" &',
                             '/opt/wakeuphere/start-browser.sh &'):
            continue
        lines.append(line)
    if managed:
        raise ValueError('Unclosed managed autostart section; repair file first')
    return '\n'.join(lines).rstrip() + '\n' + START + '\n/opt/wakeuphere/start-browser.sh &\n' + END + '\n'


if __name__ == '__main__':
    path = pathlib.Path(sys.argv[1])
    print(autostart(path.read_text() if path.exists() else '', sys.argv[2]), end='')
CONFIGURE
}

desktop_user=${SUDO_USER:-}
reboot_after=0
check_only=0
extract_dir=''
while [ "$#" -gt 0 ]; do
    case "$1" in
        --user) [ "$#" -ge 2 ] || { usage; exit 2; }; desktop_user=$2; shift 2 ;;
        --reboot) reboot_after=1; shift ;;
        --check) check_only=1; shift ;;
        --extract) [ "$#" -ge 2 ] || { usage; exit 2; }; extract_dir=$2; shift 2 ;;
        --help|-h) usage; exit 0 ;;
        *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
    esac
done
if [ -n "$extract_dir" ]; then
    payload "$extract_dir"
    echo "Payload extracted to $extract_dir; no system changes."
    exit 0
fi

die() { echo "ERROR: $*" >&2; exit 1; }
[ "$(uname -s)" = Linux ] || die 'Run this on Raspberry Pi OS, not your Mac/PC.'
[ "$EUID" -eq 0 ] || die 'Use sudo bash install-wakeuphere-pi.sh'
grep -aq 'Raspberry Pi 5' /proc/device-tree/model || die 'This installer targets Raspberry Pi 5.'
[[ "$desktop_user" =~ ^[a-z_][a-z0-9_-]*$ ]] || die 'Use --user with an existing non-root desktop account.'
[ "$desktop_user" != root ] || die 'Chromium must run as a non-root desktop user.'
account=$(getent passwd "$desktop_user") || die 'Desktop user does not exist.'
desktop_home=$(printf '%s\n' "$account" | cut -d: -f6)
desktop_uid=$(id -u "$desktop_user")
[ "$desktop_uid" -ge 1000 ] || die 'Select a normal desktop account (UID >= 1000).'
[[ "$desktop_home" =~ ^/home/[a-zA-Z0-9_-]+$ ]] || die 'Expected a home directory directly under /home.'
[ -d "$desktop_home" ] || die 'Home directory is missing.'
command -v raspi-config >/dev/null || die 'Install Raspberry Pi OS with desktop first.'
command -v labwc >/dev/null || die 'Requires the labwc desktop, not Raspberry Pi OS Lite or X11.'
command -v lightdm >/dev/null || die 'Requires the standard Raspberry Pi OS LightDM desktop.'
session_file=$(find /usr/share/wayland-sessions -maxdepth 1 -name '*labwc*.desktop' -print -quit)
[ -n "$session_file" ] || die 'No labwc Wayland session found.'
session=$(basename "$session_file" .desktop)
[[ "$session" =~ ^[a-zA-Z0-9_-]+$ ]] || die 'Unexpected desktop session name.'

echo "Desktop account: $desktop_user ($desktop_home); session: $session"
echo 'GPIO controller will be detected by pinctrl-rp1 label on every start.'
if [ "$check_only" -eq 1 ]; then
    echo 'Preflight passed. No system settings were changed.'
    exit 0
fi

# An existing managed service is upgraded below; refuse unrelated manual copies.
service_pid=$(systemctl show -p MainPID --value wakeuphere-joystick.service 2>/dev/null || true)
for pid in $(pgrep -f '^(/usr/bin/)?python3 (-u )?/home/[^/]+/wakeuphere/joystick.py( |$)' || true); do
    [ "$pid" = "$service_pid" ] || die 'Stop the manually running ~/wakeuphere/joystick.py with Ctrl+C, then retry.'
done

backup_dir="/var/backups/wakeuphere/$(date +%Y%m%d-%H%M%S)-$$"
work_dir=$(mktemp -d)
trap 'rm -rf "$work_dir"' EXIT
trap 'echo "Installation stopped at line $LINENO. Backups: $backup_dir. Fix the error and rerun; no reboot performed." >&2' ERR
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
payload "$work_dir"

backup() {
    if [ -e "$1" ]; then
        mkdir -p "$backup_dir$(dirname "$1")"
        cp -a "$1" "$backup_dir$1"
    fi
}
install_changed() {
    local source=$1 destination=$2 mode=$3
    if [ ! -f "$destination" ] || ! cmp -s "$source" "$destination"; then
        backup "$destination"
        install -D -m "$mode" -o root -g root "$source" "$destination"
    else
        chown root:root "$destination"
        chmod "$mode" "$destination"
    fi
}

echo 'Installing system packages...'
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y chromium curl gpiod python3-spidev python3-lgpio python3-evdev
python3 -m py_compile "$work_dir/joystick.py" "$work_dir/configure.py"
bash -n "$work_dir/start-browser.sh"

# Back up firmware settings before using the distribution's supported SPI switch.
for firmware in /boot/firmware/config.txt /boot/config.txt /etc/modprobe.d/raspi-blacklist.conf; do
    backup "$firmware"
done
raspi-config nonint do_spi 0
modprobe uinput
printf 'uinput\n' > "$work_dir/modules.conf"
install_changed "$work_dir/modules.conf" /etc/modules-load.d/wakeuphere.conf 644

gpiodetect | tee "$work_dir/gpiochips.txt"
python3 - "$work_dir" <<'CHECK_CHIP'
import pathlib, sys
sys.path.insert(0, sys.argv[1])
from joystick import detect_chip
text = (pathlib.Path(sys.argv[1]) / 'gpiochips.txt').read_text()
print('Detected RP1 gpiochip' + str(detect_chip(text)))
CHECK_CHIP

systemctl stop wakeuphere-joystick.service 2>/dev/null || true
install -d -o root -g root -m 755 /opt/wakeuphere
install_changed "$work_dir/joystick.py" /opt/wakeuphere/joystick.py 644
install_changed "$work_dir/start-browser.sh" /opt/wakeuphere/start-browser.sh 755
install_changed "$work_dir/wakeuphere-joystick.service" /etc/systemd/system/wakeuphere-joystick.service 644
if [ ! -e /etc/default/wakeuphere-joystick ]; then
    printf 'INVERT_X=0\nINVERT_Y=0\n' > "$work_dir/defaults"
    install_changed "$work_dir/defaults" /etc/default/wakeuphere-joystick 644
fi

cat > "$work_dir/lightdm.conf" <<LIGHTDM
[Seat:*]
autologin-user=$desktop_user
autologin-user-timeout=0
autologin-session=$session
user-session=$session
LIGHTDM
install_changed "$work_dir/lightdm.conf" /etc/lightdm/lightdm.conf.d/90-wakeuphere.conf 644

autostart_file="$desktop_home/.config/labwc/autostart"
python3 "$work_dir/configure.py" "$autostart_file" "$desktop_home" > "$work_dir/autostart"
backup "$autostart_file"
install -d -m 755 -o "$desktop_user" -g "$(id -gn "$desktop_user")" "$desktop_home/.config" "$desktop_home/.config/labwc"
install -m 644 -o "$desktop_user" -g "$(id -gn "$desktop_user")" "$work_dir/autostart" "$autostart_file"

systemctl daemon-reload
systemctl set-default graphical.target
systemctl enable lightdm.service wakeuphere-joystick.service
systemctl reset-failed wakeuphere-joystick.service || true
systemctl start wakeuphere-joystick.service

echo
echo "Installed. Backups: $backup_dir"
echo 'Release the joystick during reboot/calibration. Reboot to activate desktop changes.'
echo 'After first launch: Ctrl+U in WakeUpHere to set this device userName.'
echo 'Status: sudo systemctl status wakeuphere-joystick --no-pager'
echo 'Logs:   sudo journalctl -u wakeuphere-joystick -b -n 40 --no-pager'
echo 'Diagnostics: stop the service, then sudo python3 /opt/wakeuphere/joystick.py --diagnose'
echo 'This enables desktop autologin. The dedicated browser uses basic password storage; do not save private passwords.'
if [ "$reboot_after" -eq 1 ]; then
    echo 'Reboot requested; restarting in 5 seconds...'
    sleep 5
    systemctl reboot
else
    echo 'Run sudo reboot when ready.'
fi
