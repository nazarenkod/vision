"""Tests for how scripts/vision.sh reaches Docker when it builds.

    python3 -I scripts/tests/test_vision_sh.py

A stand-in `docker` answers the guard's questions and records the builder and the
PATH that `docker compose` was started with; nothing reaches a real Docker.
"""
import os
import pathlib
import shutil
import subprocess
import tempfile
import textwrap
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
VISION_SH = ROOT / "scripts" / "vision.sh"

FAKE_DOCKER = r'''#!/usr/bin/env python3
import os, sys
args = sys.argv[1:]
if args[:1] == ["info"]:
    sys.exit(0)
if args[:1] == ["ps"]:
    sys.exit(0)
if args[:2] == ["buildx", "inspect"]:
    print("Name:          some_builder")
    print("Driver:        " + os.environ["FAKE_DRIVER"])
    sys.exit(0)
if args[:2] == ["context", "show"]:
    print(os.environ["FAKE_CONTEXT"])
    sys.exit(0)
if args[:1] == ["compose"]:
    with open(os.environ["FAKE_LOG"], "w") as log:
        log.write("BUILDX_BUILDER=" + os.environ.get("BUILDX_BUILDER", "") + "\n")
        log.write("PATH=" + os.environ["PATH"] + "\n")
    sys.exit(0)
sys.exit(1)
'''


class VisionShTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="vision-sh-test-"))
        bin_dir = self.tmp / "bin"
        bin_dir.mkdir()
        docker = bin_dir / "docker"
        docker.write_text(FAKE_DOCKER)
        docker.chmod(0o755)
        # where Docker Desktop keeps its credential helper, outside the shell's PATH
        self.app_bin = self.tmp / "Docker.app-bin"
        self.app_bin.mkdir()
        helper = self.app_bin / "docker-credential-desktop"
        helper.write_text("#!/bin/sh\nexit 0\n")
        helper.chmod(0o755)
        env_file = self.tmp / "env"
        env_file.write_text(textwrap.dedent("""\
            VISION_DISK_RESERVE_GB=0
            """))
        self.log = self.tmp / "compose.log"
        self.env = {
            "PATH": f"{bin_dir}:/usr/bin:/bin",
            "HOME": str(self.tmp),
            "VISION_ENV_FILE": str(env_file),
            "VISION_DOCKER_APP_BIN": str(self.app_bin),
            "FAKE_LOG": str(self.log),
            "FAKE_DRIVER": "docker",
            "FAKE_CONTEXT": "desktop-linux",
        }

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def compose_env(self, *args, **env):
        done = subprocess.run([str(VISION_SH), *args], env={**self.env, **env},
                              capture_output=True, text=True, timeout=60)
        self.assertEqual(done.returncode, 0, done.stderr)
        values = dict(line.split("=", 1) for line in self.log.read_text().splitlines())
        return values, done.stdout

    def test_builds_with_the_engines_own_builder_when_a_container_builder_is_selected(self):
        values, out = self.compose_env("up", "-d", "--build", FAKE_DRIVER="docker-container")
        self.assertEqual(values["BUILDX_BUILDER"], "desktop-linux")
        self.assertIn('builder "desktop-linux"', out)

    def test_leaves_the_builder_alone_when_it_is_the_engines_own(self):
        values, _ = self.compose_env("up", "-d", "--build")
        self.assertEqual(values["BUILDX_BUILDER"], "")

    def test_keeps_a_builder_chosen_in_the_environment(self):
        values, _ = self.compose_env("up", "-d", "--build", FAKE_DRIVER="docker-container",
                                     BUILDX_BUILDER="mine")
        self.assertEqual(values["BUILDX_BUILDER"], "mine")

    def test_does_not_touch_the_builder_without_a_build(self):
        values, _ = self.compose_env("ps", "-a", FAKE_DRIVER="docker-container")
        self.assertEqual(values["BUILDX_BUILDER"], "")

    def test_finds_docker_desktops_credential_helper_outside_the_path(self):
        values, _ = self.compose_env("up", "-d", "--build")
        self.assertEqual(values["PATH"].split(":")[0], str(self.app_bin))

    def test_keeps_the_path_when_the_credential_helper_is_already_on_it(self):
        values, _ = self.compose_env("ps", "-a", PATH=f"{self.app_bin}:{self.env['PATH']}")
        self.assertEqual(values["PATH"].split(":").count(str(self.app_bin)), 1)


if __name__ == "__main__":
    unittest.main()
