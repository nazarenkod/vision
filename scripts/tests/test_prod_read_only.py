"""Production VRT is only read: scripts/demo-clone-from-prod.sh and the guards of
scripts/lib/vision-safety.sh (ADR-0002).

    python3 -I scripts/tests/test_prod_read_only.py

A stand-in `docker` answers as production's Postgres container ("prodpg") and as
Vision's ("visionpg"), and writes down every command. No database and no Docker are
needed, so this runs on any machine, macOS included. The cut-over to a new Vision
copies production the same way, so these are the checks it relies on.
"""
import json
import os
import pathlib
import stat
import subprocess
import sys
import tempfile
import textwrap
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
COMPOSE_FILE = ROOT / "docker-compose.demo.yml"
MIGRATIONS = sorted(p.name for p in (ROOT / "backend" / "prisma" / "migrations").iterdir() if p.is_dir())

FAKE_DOCKER = r'''#!/usr/bin/env python3
import json, os, sys
args = sys.argv[1:]
with open(os.environ["FAKE_LOG"], "a") as f:
    f.write(json.dumps(args) + "\n")
env = os.environ

def answer_sql(sql, side):
    sql = " ".join(sql.split())
    if "pg_database_size" in sql:
        return "1048576"
    if "current_database()" in sql:
        return "vrt"
    if "to_regclass" in sql:
        return "1" if side == "prod" and env.get("FAKE_PROD_HAS_VRT", "1") == "1" else ("1" if side == "vision" else "0")
    if 'count(*) from "Project"' in sql:
        # Vision's database is empty until the copy is restored into it (so no backup step)
        restored = os.path.exists(env["FAKE_LOG"] + ".restored")
        return "0" if side == "vision" and not restored else "2"
    if 'count(*) from "User"' in sql:
        return "3"
    if "from \"Project\" p order by" in sql:
        return "Android app  (5 builds, 9 baselines)\niOS app  (2 builds, 4 baselines)"
    if "migration_name = '20230730154101_init'" in sql:
        return "1"
    if "max(migration_name)" in sql:
        return env["FAKE_MIGRATIONS"].split(",")[-1]
    if "select migration_name from _prisma_migrations" in sql:
        return "\n".join(env["FAKE_MIGRATIONS"].split(","))
    return ""

if args[0] == "info":
    sys.exit(0)
if args[0] == "ps":
    print(env.get("FAKE_PROJECT_CONTAINERS", ""))
    sys.exit(0)
if args[0] == "inspect":
    fmt, name = (args[2], args[3]) if args[1] == "-f" else ("", args[1])
    if name not in ("prodpg", "visionpg"):
        sys.exit(1)
    if "config_files" in fmt:
        print(env["FAKE_COMPOSE_FILE"])
    elif "compose.project" in fmt:
        print(env.get("FAKE_PROD_PROJECT", "vrt") if name == "prodpg" else "vision")
    elif "{{.Id}}" in fmt:
        print(env.get("FAKE_PROD_ID", "prodpg"))
    sys.exit(0)
if args[0] == "compose":
    rest = args[1:]
    while rest[0] in ("-p", "-f", "--env-file"):
        rest = rest[2:]
    if rest[:2] == ["ps", "-q"]:
        print("visionpg")
    sys.exit(0)
if args[0] == "exec":
    rest = args[1:]
    while rest[0].startswith("-"):
        rest = rest[2:] if rest[0] == "-e" else rest[1:]
    container, command = rest[0], rest[1:]
    side = "prod" if container == "prodpg" else "vision"
    if command[:2] == ["sh", "-c"]:
        script = command[2]
        if "pg_dump" in script:
            sys.stdout.write("PGDMP fake dump")
            sys.exit(0)
        print(answer_sql(command[3], side))
        sys.exit(0)
    if command[0] == "psql" and "-tAc" in command:
        print(answer_sql(command[command.index("-tAc") + 1], side))
        sys.exit(0)
    sys.stdin.read()
    if command[0] == "pg_restore":
        open(env["FAKE_LOG"] + ".restored", "w").close()
    sys.exit(0)  # psql -c DROP SCHEMA / pg_restore on Vision's container
sys.exit("fake docker: unknown command " + " ".join(args))
'''


class ProdIsReadOnly(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp())
        bin_dir = self.tmp / "bin"
        bin_dir.mkdir()
        docker = bin_dir / "docker"
        docker.write_text(FAKE_DOCKER)
        docker.chmod(docker.stat().st_mode | stat.S_IEXEC)
        self.log = self.tmp / "docker.log"
        self.prod_images = self.tmp / "prod-images"
        self.prod_images.mkdir()
        for name in ("a.screenshot.png", "b.baseline.png", "c.uitree.json.gz"):
            (self.prod_images / name).write_bytes(b"production " + name.encode())
        self.data = self.tmp / "data"
        self.env = dict(
            os.environ,
            PATH=f"{bin_dir}:{os.environ['PATH']}",
            FAKE_LOG=str(self.log),
            FAKE_COMPOSE_FILE=str(COMPOSE_FILE),
            FAKE_MIGRATIONS=",".join(MIGRATIONS[:5]),
            VISION_DISK_RESERVE_GB="0",
            # or vision_docker_path puts Docker Desktop's real docker ahead of the stand-in
            VISION_DOCKER_APP_BIN=str(self.tmp / "no-docker-desktop"),
        )

    def write_env(self, extra=""):
        path = self.tmp / ".env.demo"
        path.write_text(textwrap.dedent(f"""\
            POSTGRES_USER=postgres
            POSTGRES_DB=vrt_demo
            VISION_DATA_DIR={self.data}
            PROD_PG_CONTAINER=prodpg
            PROD_IMAGES_DIR={self.prod_images}
            """) + extra)
        return path

    def clone(self, extra_env=None, env_file_extra=""):
        env = dict(self.env, VISION_ENV_FILE=str(self.write_env(env_file_extra)), **(extra_env or {}))
        return subprocess.run(["bash", str(SCRIPTS / "demo-clone-from-prod.sh"), "--yes"],
                              capture_output=True, text=True, env=env, timeout=60, stdin=subprocess.DEVNULL)

    def commands(self):
        return [json.loads(line) for line in self.log.read_text().splitlines()] if self.log.exists() else []

    def prod_commands(self):
        return [c for c in self.commands() if "prodpg" in c]

    def snapshot(self, folder):
        return {p.name: (p.read_bytes(), p.stat().st_mtime_ns) for p in sorted(folder.iterdir())}

    def test_only_reads_and_dumps_the_production_database(self):
        done = self.clone()
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        prod = self.prod_commands()
        self.assertTrue(prod, "production was not even read")
        for command in prod:
            if command[0] == "inspect":
                continue
            self.assertEqual(command[0], "exec", command)
            script = command[command.index("sh") + 2]
            if "pg_dump" in script:
                self.assertNotIn("--clean", script)
                continue
            sql = " ".join(command[-1].split()).lower()
            self.assertTrue(sql.startswith("select"), f"not a read on production: {sql}")
        self.assertTrue(any("pg_dump" in " ".join(c) for c in prod), "no dump of production")

    def test_writes_only_into_visions_own_database(self):
        done = self.clone()
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        writes = [c for c in self.commands() if c[0] == "exec" and any(w in " ".join(c) for w in ("DROP SCHEMA", "pg_restore"))]
        self.assertEqual(len(writes), 2, writes)
        for command in writes:
            self.assertIn("visionpg", command)
            self.assertNotIn("prodpg", command)

    def test_leaves_production_images_as_they_were(self):
        before = self.snapshot(self.prod_images)
        done = self.clone()
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertEqual(self.snapshot(self.prod_images), before)
        copied = self.data / "imageUploads"
        self.assertEqual(sorted(p.name for p in copied.iterdir()), sorted(before))

    def test_refuses_when_the_vision_project_holds_a_container_from_another_compose_file(self):
        done = self.clone({"FAKE_PROJECT_CONTAINERS": "vrt-postgres-1|/srv/vrt/docker-compose.yml"})
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("Nothing was done", done.stderr)
        self.assertFalse(any(c[0] == "exec" for c in self.commands()))

    def test_refuses_when_the_production_container_belongs_to_vision(self):
        done = self.clone({"FAKE_PROD_PROJECT": "vision"})
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("belongs to the Vision project itself", done.stderr)
        self.assertFalse(any(c[0] == "exec" for c in self.commands()))

    def test_refuses_a_database_without_vrt_tables(self):
        done = self.clone({"FAKE_PROD_HAS_VRT": "0"})
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("has no VRT tables", done.stderr)
        self.assertFalse(any("pg_dump" in " ".join(c) for c in self.commands()))

    def test_refuses_production_images_pointing_at_visions_own_folder(self):
        (self.data / "imageUploads").mkdir(parents=True)
        self.prod_images = self.data / "imageUploads"
        done = self.clone()
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("points at Vision's own image folder", done.stderr)
        self.assertFalse(any("pg_dump" in " ".join(c) for c in self.commands()))

    def test_refuses_when_visions_postgres_is_productions_container(self):
        done = self.clone({"FAKE_PROD_ID": "visionpg"})
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("are the same container", done.stderr)
        self.assertFalse(any("pg_dump" in " ".join(c) or "DROP SCHEMA" in " ".join(c) for c in self.commands()))


if __name__ == "__main__":
    unittest.main()
