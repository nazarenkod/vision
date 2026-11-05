"""Tests for scripts/build-sdk-jar.sh: the SDK is published under its own coordinates (040).

    python3 -I scripts/tests/test_build_sdk_jar.py

Builds the real SDK with Gradle (offline, from its cache) into a copy of the repository, so
dist/ of the checkout is not touched. Skipped without Gradle and Java.
"""
import os
import pathlib
import shutil
import subprocess
import tempfile
import unittest
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[2]


@unittest.skipUnless(shutil.which("gradle") and shutil.which("java"), "needs Gradle and Java")
class BuildSdkJar(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp = pathlib.Path(tempfile.mkdtemp())
        shutil.copytree(ROOT / "scripts", cls.tmp / "scripts")
        shutil.copytree(ROOT / "sdk-java", cls.tmp / "sdk-java", ignore=shutil.ignore_patterns("build", ".gradle"))
        old = cls.tmp / "dist" / "sdk-java"
        old.mkdir(parents=True)
        (old / "sdk-java-4.3.1-vision.4.jar").write_bytes(b"old")
        (old / "sdk-java-4.3.1-vision.4.pom").write_bytes(b"old")
        cls.done = subprocess.run(["bash", str(cls.tmp / "scripts" / "build-sdk-jar.sh")], capture_output=True, text=True,
                                  env=dict(os.environ, VISION_GRADLE_FLAGS="--offline"), timeout=600)
        cls.dist = old

    @classmethod
    def tearDownClass(cls):
        shutil.rmtree(cls.tmp, ignore_errors=True)

    def test_publishes_ua_vision_vision_sdk_with_its_own_version(self):
        self.assertEqual(self.done.returncode, 0, self.done.stdout + self.done.stderr)
        pom = (self.dist / "vision-sdk-1.0.0.pom").read_text()
        self.assertIn("<groupId>ua.vision</groupId>", pom)
        self.assertIn("<artifactId>vision-sdk</artifactId>", pom)
        self.assertIn("<version>1.0.0</version>", pom)

    def test_leaves_only_the_new_jar_in_dist(self):
        self.assertEqual(self.done.returncode, 0, self.done.stdout + self.done.stderr)
        self.assertEqual(sorted(p.name for p in self.dist.iterdir()), ["vision-sdk-1.0.0.jar", "vision-sdk-1.0.0.pom"])

    def test_the_jar_holds_no_name_of_vrt(self):
        self.assertEqual(self.done.returncode, 0, self.done.stdout + self.done.stderr)
        with zipfile.ZipFile(self.dist / "vision-sdk-1.0.0.jar") as jar:
            names = jar.namelist()
            self.assertIn("ua/vision/sdk/Vision.class", names)
            self.assertFalse([n for n in names if "visual_regression" in n or "visual-regression" in n], names)
            content = b"".join(jar.read(n) for n in names if n.endswith(".class"))
        for old in (b"Visual Regression Tracker", b"VRT_", b"vrt.json"):
            self.assertNotIn(old, content)


if __name__ == "__main__":
    unittest.main()
