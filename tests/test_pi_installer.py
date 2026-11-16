"""Hardware-free tests for the exact payload embedded in the installer."""
import importlib.util
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]


def load(path):
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


class InstallerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.TemporaryDirectory()
        cls.payload = pathlib.Path(cls.tmp.name)
        subprocess.run(['bash', str(ROOT / 'scripts/install-wakeuphere-pi.sh'),
                        '--extract', str(cls.payload)], check=True)
        cls.controller = load(cls.payload / 'joystick.py')
        cls.config = load(cls.payload / 'configure.py')

    @classmethod
    def tearDownClass(cls):
        cls.tmp.cleanup()

    def test_rp1_detection_never_guesses_the_chip_number(self):
        detect = self.controller.detect_chip
        self.assertEqual(detect('gpiochip11 [brcm] (15 lines)\ngpiochip15 [pinctrl-rp1] (54 lines)'), 15)
        self.assertEqual(detect('gpiochip0 [pinctrl-rp1] (54 lines)'), 0)
        with self.assertRaises(RuntimeError):
            detect('gpiochip0 [brcm] (54 lines)')
        with self.assertRaises(RuntimeError):
            detect('gpiochip0 [pinctrl-rp1] (54 lines)\ngpiochip4 [pinctrl-rp1] (54 lines)')

    def test_deadzone_direction_and_inversion(self):
        direction = self.controller.direction
        self.assertIsNone(direction(100, -100))
        self.assertEqual(direction(400, 50), 'right')
        self.assertEqual(direction(-400, 50), 'left')
        self.assertEqual(direction(50, 400), 'down')
        self.assertEqual(direction(50, -400), 'up')
        self.assertEqual(direction(400, 50, invert_x=True), 'left')
        self.assertEqual(direction(50, 400, invert_y=True), 'up')

    def test_debounce_produces_one_press_until_released(self):
        button = self.controller.DebouncedButton(1, 0)
        self.assertFalse(button.update(0, 0.01))
        self.assertFalse(button.update(1, 0.02))
        self.assertFalse(button.update(0, 0.03))
        self.assertTrue(button.update(0, 0.09))
        self.assertFalse(button.update(0, 0.2))
        self.assertFalse(button.update(1, 0.3))
        self.assertFalse(button.update(1, 0.36))
        self.assertFalse(button.update(0, 0.4))
        self.assertTrue(button.update(0, 0.46))

    def test_autostart_is_idempotent_and_migrates_only_known_launchers(self):
        original = 'panel &\n/home/test/wakeuphere/start-browser.sh &\nother-app &\n'
        once = self.config.autostart(original, '/home/test')
        twice = self.config.autostart(once, '/home/test')
        self.assertEqual(once, twice)
        self.assertIn('panel &', once)
        self.assertIn('other-app &', once)
        self.assertEqual(once.count('\n/opt/wakeuphere/start-browser.sh &'), 1)
        self.assertNotIn('\n/home/test/wakeuphere/start-browser.sh &', once)

    def test_embedded_payload_syntax_and_service(self):
        for path in self.payload.glob('*.py'):
            compile(path.read_text(), str(path), 'exec')
        subprocess.run(['bash', '-n', str(self.payload / 'start-browser.sh')], check=True)
        service = (self.payload / 'wakeuphere-joystick.service').read_text()
        self.assertIn('ExecStart=/usr/bin/python3 -u /opt/wakeuphere/joystick.py', service)
        self.assertIn('Restart=on-failure', service)
        self.assertIn('--password-store=basic', (self.payload / 'start-browser.sh').read_text())
        self.assertIn('--autoplay-policy=no-user-gesture-required', (self.payload / 'start-browser.sh').read_text())

    def test_broken_managed_section_is_not_silently_deleted(self):
        with self.assertRaises(ValueError):
            self.config.autostart('panel &\n# BEGIN WAKEUPHERE MANAGED\nother-app &', '/home/test')

    def test_help_and_invalid_option(self):
        script = str(ROOT / 'scripts/install-wakeuphere-pi.sh')
        result = subprocess.run(['bash', script, '--help'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0)
        self.assertIn('--check', result.stdout)
        result = subprocess.run(['bash', script, '--nonexistent-option'], capture_output=True, text=True)
        self.assertEqual(result.returncode, 2)


if __name__ == '__main__':
    unittest.main()
