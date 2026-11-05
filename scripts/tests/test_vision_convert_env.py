"""The settings of an older Vision are converted for this version (plan 3.4).

    python3 -I scripts/tests/test_vision_convert_env.py
"""
import importlib.util
import io
import pathlib
import tempfile
import unittest
from contextlib import redirect_stdout

ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("convert", ROOT / "scripts" / "vision-convert-env.py")
convert = importlib.util.module_from_spec(spec)
spec.loader.exec_module(convert)

OLD = """# the older Vision
DEMO_UI_PORT=18080
DEMO_POSTGRES_PORT=15432
JWT_SECRET=old-jwt-secret
VRT_VERSION=demo
VRT_DISK_RESERVE_GB=20
VISION_DISK_RESERVE_GB=15
PROD_PG_CONTAINER=vrt-postgres-1
"""


def values(text):
    return dict(line.split("=", 1) for line in text.splitlines() if "=" in line and not line.startswith("#"))


class ConvertEnvTest(unittest.TestCase):
    def test_gives_an_older_file_what_this_version_needs(self):
        made = iter(["new-jwt", "new-secret-key"])
        text, changes = convert.convert(OLD, "jira.bank.example", make_secret=lambda: next(made))
        after = values(text)

        self.assertEqual(after["VISION_VERSION"], "demo")
        # a VISION_* already set wins over the VRT_* it replaces
        self.assertEqual(after["VISION_DISK_RESERVE_GB"], "15")
        self.assertNotIn("VRT_VERSION", after)
        self.assertNotIn("VRT_DISK_RESERVE_GB", after)
        self.assertEqual(after["JWT_SECRET"], "new-jwt")
        self.assertEqual(after["VISION_SECRET_KEY"], "new-secret-key")
        self.assertEqual(after["VISION_JIRA_HOSTS"], "jira.bank.example")
        # the database the old version created stays the one used
        self.assertEqual(after["POSTGRES_DB"], "vrt_demo")
        self.assertNotIn("DEMO_POSTGRES_PORT", after)
        # the rest, comments too, as it was
        self.assertEqual(after["PROD_PG_CONTAINER"], "vrt-postgres-1")
        self.assertIn("# the older Vision", text)
        self.assertEqual(len(changes), 7)

    def test_keeps_a_secret_key_already_set_and_a_database_named(self):
        text, _ = convert.convert("VISION_SECRET_KEY=kept-key\nPOSTGRES_DB=vision\nVISION_JIRA_HOSTS=a.example\n",
                                  None, make_secret=lambda: "x")
        after = values(text)
        self.assertEqual(after["VISION_SECRET_KEY"], "kept-key")
        self.assertEqual(after["POSTGRES_DB"], "vision")
        self.assertEqual(after["VISION_JIRA_HOSTS"], "a.example")
        # a placeholder is no key
        text, _ = convert.convert("VISION_SECRET_KEY=change-me\n", None, make_secret=lambda: "made")
        self.assertEqual(values(text)["VISION_SECRET_KEY"], "made")

    def test_writes_only_after_yes_and_keeps_the_old_file(self):
        with tempfile.TemporaryDirectory() as folder:
            env = pathlib.Path(folder) / ".env.demo"
            env.write_text(OLD)
            out = io.StringIO()
            with redirect_stdout(out):
                self.assertEqual(convert.main(["--env-file", str(env), "--jira-hosts", "Jira.Bank.Example", "--yes"]), 0)
            # secrets are not printed
            self.assertNotIn("old-jwt-secret", out.getvalue())
            self.assertEqual(values(env.read_text())["VISION_JIRA_HOSTS"], "jira.bank.example")
            kept = [p for p in pathlib.Path(folder).iterdir() if p.name.startswith(".env.demo.before-vision-")]
            self.assertEqual(len(kept), 1)
            self.assertEqual(kept[0].read_text(), OLD)
            self.assertEqual(env.stat().st_mode & 0o777, 0o600)
            # a second run keeps the key it made: tokens sealed with it stay readable
            key = values(env.read_text())["VISION_SECRET_KEY"]
            with redirect_stdout(io.StringIO()):
                convert.main(["--env-file", str(env), "--yes"])
            self.assertEqual(values(env.read_text())["VISION_SECRET_KEY"], key)


if __name__ == "__main__":
    unittest.main()
