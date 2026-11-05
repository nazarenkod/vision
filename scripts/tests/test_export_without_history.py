"""The export without history (plan 3.6): one commit, tracked files only, nothing pushed.

    python3 -I scripts/tests/test_export_without_history.py

Runs the script on a small throwaway repository, never on this one's history.
"""
import pathlib
import subprocess
import tempfile
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "export-without-history.sh"


def git(folder, *args):
    return subprocess.run(["git", "-C", str(folder), *args], capture_output=True, text=True, check=True).stdout


class ExportWithoutHistoryTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        self.repo = self.tmp / "repo"
        (self.repo / "scripts").mkdir(parents=True)
        (self.repo / "sdk-java").mkdir()
        (self.repo / "scripts" / "export-without-history.sh").write_text(SCRIPT.read_text())
        (self.repo / "sdk-java" / "build.gradle").write_text("version = '1.0.0'\n")
        (self.repo / ".gitignore").write_text(".env.demo\n")
        git(self.repo, "init", "-q")
        git(self.repo, "config", "user.name", "Owner")
        git(self.repo, "config", "user.email", "owner@example.com")
        (self.repo / "secret.txt").write_text("first version with a secret")
        git(self.repo, "add", "-A")
        git(self.repo, "commit", "-q", "-m", "first")
        (self.repo / "secret.txt").write_text("cleaned")
        git(self.repo, "commit", "-q", "-am", "second")
        (self.repo / ".env.demo").write_text("JWT_SECRET=local")

    def export(self, target):
        return subprocess.run(["bash", str(self.repo / "scripts" / "export-without-history.sh"), str(target)],
                              capture_output=True, text=True)

    def test_exports_one_commit_of_tracked_files(self):
        target = self.tmp / "export"
        done = self.export(target)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(git(target, "rev-list", "--count", "HEAD").strip(), "1")
        self.assertEqual(git(target, "log", "--format=%s").strip(), "Vision 1.0.0")
        self.assertEqual((target / "secret.txt").read_text(), "cleaned")
        # what was in the history is not there, nor what was never committed
        everything = git(target, "rev-list", "--all", "--objects")
        self.assertEqual(len([line for line in everything.splitlines() if "secret.txt" in line]), 1)
        self.assertFalse((target / ".env.demo").exists())
        self.assertEqual(git(target, "remote").strip(), "")

    def test_refuses_a_folder_that_is_not_empty(self):
        target = self.tmp / "busy"
        target.mkdir()
        (target / "keep.txt").write_text("mine")
        done = self.export(target)
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("is not empty", done.stderr)
        self.assertEqual(sorted(p.name for p in target.iterdir()), ["keep.txt"])


if __name__ == "__main__":
    unittest.main()
