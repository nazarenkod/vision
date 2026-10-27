"""Tests for scripts/vision-backup.sh, scripts/vision-restore.sh and the backup step of
scripts/demo-clone-from-prod.sh.

    python3 -I scripts/tests/test_vision_backup.py

The scripts run for real against a local PostgreSQL (16, like Vision's container):
a stand-in `docker` runs `docker exec <container> psql/pg_dump/pg_restore` locally as
the postgres user, and a stand-in `rclone` keeps the "Google Drive" in a folder. The
databases get the schema from backend/prisma/migrations. Without a local PostgreSQL
reachable as the postgres user, the tests are skipped.
"""
import os
import pathlib
import shutil
import subprocess
import sys
import tarfile
import tempfile
import textwrap
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / "scripts"
MIGRATIONS = ROOT / "backend" / "prisma" / "migrations"
NODE_MODULES = ROOT / "backend" / "node_modules"
COMPOSE_FILE = ROOT / "docker-compose.demo.yml"
MASTER_PASSWORD = "master-password-42"

FAKE_DOCKER = r'''#!/usr/bin/env python3
import os, subprocess, sys
args = sys.argv[1:]
log = os.environ["FAKE_LOG"]
with open(log, "a") as f:
    f.write("docker " + " ".join(args) + "\n")
containers = dict(item.split(":") for item in os.environ["FAKE_CONTAINERS"].split(","))

def run_as_postgres(container, env_pairs, command):
    if container not in containers:
        sys.exit(f"no such container {container}")
    if os.environ.get("FAKE_FAIL_PG_DUMP") == container and "pg_dump" in command:
        sys.exit("pg_dump: simulated failure")
    env = ["POSTGRES_USER=postgres", "POSTGRES_DB=" + containers[container]] + env_pairs
    sys.exit(subprocess.call(["runuser", "-u", "postgres", "--", "env", "-C", "/tmp"] + env + command))

if args[0] == "info":
    sys.exit(0)
if args[0] == "ps":
    sys.exit(0)
if args[0] == "inspect":
    fmt, name = (args[2], args[3]) if args[1] == "-f" else ("", args[1])
    if name not in containers:
        sys.exit(1)
    if "config_files" in fmt:
        print(os.environ["FAKE_CONFIG_FILES"])
    elif "compose.project" in fmt:
        print("vrt" if name != os.environ.get("FAKE_VISION_PG") else "vision")
    elif fmt:
        print(name)
    sys.exit(0)
if args[0] == "exec":
    rest, env_pairs = args[1:], []
    while rest[0].startswith("-"):
        if rest[0] == "-e":
            env_pairs.append(rest[1])
            rest = rest[2:]
        else:
            rest = rest[1:]
    run_as_postgres(rest[0], env_pairs, rest[1:])
if args[0] == "run" and any(a.startswith("rclone/rclone:") for a in args):
    image = next(i for i, a in enumerate(args) if a.startswith("rclone/rclone:"))
    sys.exit(subprocess.call([os.environ["FAKE_RCLONE_BIN"]] + args[image + 1:]))
if args[0] == "compose":
    rest = args[1:]
    while rest[0] in ("-p", "-f", "--env-file"):
        rest = rest[2:]
    if rest[:2] == ["ps", "-q"]:
        print(os.environ.get("FAKE_VISION_PG", ""))
        sys.exit(0)
    if rest[0] == "run":
        node = rest.index("--entrypoint")
        code = rest[rest.index("-e", node) + 1]
        env = dict(os.environ, NODE_PATH=os.environ["FAKE_NODE_MODULES"])
        sys.exit(subprocess.call(["node", "-e", code], env=env))
    sys.exit(0)  # up, stop, exec pg_isready
sys.exit("fake docker: unknown command " + " ".join(args))
'''

FAKE_RCLONE = r'''#!/usr/bin/env python3
import os, pathlib, shutil, sys
files_from = None
if "--files-from" in sys.argv:
    files_from = sys.argv[sys.argv.index("--files-from") + 1]
args = [a for a in sys.argv[1:] if not a.startswith("--") and a != files_from]
flags = [a for a in sys.argv[1:] if a.startswith("--")]
with open(os.environ["FAKE_LOG"], "a") as f:
    f.write("rclone " + " ".join(sys.argv[1:]) + " config=" + os.environ.get("RCLONE_CONFIG", "") + "\n")
if os.environ.get("FAKE_RCLONE_FAIL"):
    sys.exit("rclone: simulated network failure")
root = pathlib.Path(os.environ["FAKE_DRIVE"])
def place(p):
    # "fake:x" is the Drive root; any other remote, like "vision-drive:x", a folder named after it
    name, sep, rest = p.partition(":")
    if not sep or "/" in name:
        return pathlib.Path(p)
    return root / rest if name == "fake" else root / name / rest
command = args[0]
if command == "lsf":
    folder = place(args[1])
    items = (folder.rglob("*") if "-R" in sys.argv else folder.iterdir()) if folder.exists() else []
    for item in sorted(items):
        if item.is_file():
            print(item.relative_to(folder))
elif command == "cat":
    sys.stdout.write(place(args[1]).read_text())
elif command == "delete":
    folder = place(args[1])
    for line in pathlib.Path(files_from).read_text().splitlines():
        if line:
            (folder / line).unlink()
elif command == "copyto":
    target = place(args[2])
    target.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(place(args[1]), target)
elif command == "copy":
    source, target = place(args[1]), place(args[2])
    for item in source.rglob("*"):
        if item.is_file():
            dest = target / item.relative_to(source)
            if "--ignore-existing" in flags and dest.exists():
                continue
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(item, dest)
elif command == "deletefile":
    place(args[1]).unlink()
else:
    sys.exit("fake rclone: unknown command " + command)
'''

FAKE_CRONTAB = r'''#!/bin/sh
if [ "$1" = "-l" ]; then cat "$FAKE_CRONTAB_FILE" 2>/dev/null; exit 0; fi
cat > "$FAKE_CRONTAB_FILE"
'''

SEED = textwrap.dedent('''
    INSERT INTO "User" (id, email, password, "apiKey", role, "jiraToken", "jiraEmail", "updatedAt") VALUES
      ('u1', 'owner@bank.test', '$2a$10$abcdefghijklmnopqrstuuTnJ8s4Yyq6CzXqH3XoWg0b2eV8b5G1i', 'KEY-OWNER-1', 'admin', 'jira-secret-owner', 'owner@bank.test', now()),
      ('u2', 'qa@bank.test', '$2a$10$abcdefghijklmnopqrstuuTnJ8s4Yyq6CzXqH3XoWg0b2eV8b5G1j', 'KEY-QA-2', 'editor', 'jira-secret-qa', null, now());
    INSERT INTO "Project" (id, name, "jiraUrl", "jiraToken", "uiTreeSettings", "updatedAt") VALUES
      ('p1', 'Android app', 'https://bank.atlassian.net', 'jira-secret-project', '{"elementRules": [{"id": "r1", "selector": "id:clock", "action": "ignore"}]}', now());
    INSERT INTO "Build" (id, "projectId", "userId", "updatedAt") VALUES ('b1', 'p1', 'u1', now());
    INSERT INTO "TestVariation" (id, name, "projectId", "baselineName", "updatedAt") VALUES ('v1', 'Payment', 'p1', 'base.png', now());
    INSERT INTO "Baseline" (id, "baselineName", "testVariationId", "userId", "updatedAt") VALUES ('bl1', 'base.png', 'v1', 'u1', now());
    INSERT INTO "TestRun" (id, "imageName", status, "buildId", "testVariationId", name, "updatedAt") VALUES ('t1', 'run.png', 'ok', 'b1', 'v1', 'Payment', now());
''')


def psql(db, sql, check=True):
    done = subprocess.run(["runuser", "-u", "postgres", "--", "psql", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-d", db],
                          input=sql, capture_output=True, text=True, cwd="/tmp")
    if check and done.returncode:
        raise AssertionError(done.stderr)
    return done.stdout.strip()


def postgres_available():
    if not shutil.which("runuser") or not shutil.which("psql") or not NODE_MODULES.exists():
        return False
    try:
        return psql("postgres", "select 1", check=False) == "1"
    except OSError:
        return False


def create_database(name, seed=True):
    psql("postgres", f'DROP DATABASE IF EXISTS "{name}"; CREATE DATABASE "{name}";')
    if not seed:
        return
    psql(name, 'CREATE TABLE _prisma_migrations (id varchar(36) PRIMARY KEY, checksum varchar(64) NOT NULL, '
               'finished_at timestamptz, migration_name varchar(255) NOT NULL, logs text, rolled_back_at timestamptz, '
               'started_at timestamptz NOT NULL DEFAULT now(), applied_steps_count integer NOT NULL DEFAULT 0);')
    for folder in sorted(p for p in MIGRATIONS.iterdir() if p.is_dir()):
        psql(name, (folder / "migration.sql").read_text())
        psql(name, f"INSERT INTO _prisma_migrations (id, checksum, finished_at, migration_name) "
                   f"VALUES (gen_random_uuid()::text, 'x', now(), '{folder.name}');")
    psql(name, SEED)


@unittest.skipUnless(postgres_available(), "needs a local PostgreSQL reachable as the postgres user, and backend/node_modules")
class VisionBackupTest(unittest.TestCase):
    def setUp(self):
        self.tmp = pathlib.Path(tempfile.mkdtemp(prefix="vision-backup-test-"))
        os.chmod(self.tmp, 0o755)
        bin_dir = self.tmp / "bin"
        bin_dir.mkdir()
        for name, body in (("docker", FAKE_DOCKER), ("rclone", FAKE_RCLONE), ("crontab", FAKE_CRONTAB)):
            path = bin_dir / name
            path.write_text(body)
            path.chmod(0o755)
        self.data = self.tmp / "data"
        (self.data / "imageUploads").mkdir(parents=True)
        (self.data / "imageUploads" / "base.png").write_bytes(b"png-1")
        self.drive = self.tmp / "drive"
        self.drive.mkdir()
        self.log = self.tmp / "calls.log"
        self.db = "vision_backup_test"
        create_database(self.db)
        self.env = dict(
            os.environ,
            PATH=f"{bin_dir}:{os.environ['PATH']}",
            FAKE_LOG=str(self.log),
            FAKE_DRIVE=str(self.drive),
            FAKE_CRONTAB_FILE=str(self.tmp / "crontab"),
            FAKE_CONTAINERS=f"visionpg:{self.db},prodpg:vision_backup_test_prod",
            FAKE_VISION_PG="visionpg",
            FAKE_CONFIG_FILES=str(COMPOSE_FILE),
            FAKE_NODE_MODULES=str(NODE_MODULES),
            VISION_ENV_FILE=str(self.write_env(self.db, self.data)),
        )

    def tearDown(self):
        shutil.rmtree(self.tmp, ignore_errors=True)

    def write_env(self, db, data, extra=""):
        env = self.tmp / f"env-{db}"
        env.write_text(textwrap.dedent(f"""\
            POSTGRES_USER=postgres
            POSTGRES_DB={db}
            VISION_DATA_DIR={data}
            VISION_DISK_RESERVE_GB=0
            BACKUP_REMOTE=fake:vision-backups
            VISION_MASTER_EMAIL=master@bank.test
            VISION_MASTER_PASSWORD={MASTER_PASSWORD}
            """) + extra)
        return env

    def run_script(self, name, *args, env=None, stdin=""):
        return subprocess.run([str(SCRIPTS / name), *args], env=env or self.env, input=stdin,
                              capture_output=True, text=True, timeout=120)

    def backup(self, *args, env=None):
        done = self.run_script("vision-backup.sh", *args, env=env)
        return done

    def remote_dumps(self):
        folder = self.drive / "vision-backups" / "db"
        return sorted(p.name for p in folder.glob("*.tar")) if folder.exists() else []

    def unpack(self, tar):
        out = self.tmp / ("unpacked-" + tar.name)
        with tarfile.open(tar) as archive:
            archive.extractall(out, filter="data")
        return out

    # ---- backup ------------------------------------------------------------------------

    def test_uploads_the_dump_and_new_images_to_the_remote(self):
        done = self.backup()
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(len(self.remote_dumps()), 1)
        self.assertEqual((self.drive / "vision-backups" / "images" / "base.png").read_bytes(), b"png-1")
        status = (self.data / "backup-status" / "status.json").read_text()
        self.assertIn('"lastError": null', status)
        self.assertNotIn('"lastSuccessAt": null', status)
        # images already on the remote are not sent again
        (self.data / "imageUploads" / "new.png").write_bytes(b"png-2")
        self.log.write_text("")
        self.assertEqual(self.backup().returncode, 0)
        self.assertTrue((self.drive / "vision-backups" / "images" / "new.png").exists())
        self.assertIn("--ignore-existing", self.log.read_text())

    def test_leaves_passwords_and_jira_tokens_out_of_the_backup(self):
        self.assertEqual(self.backup().returncode, 0)
        tar = self.drive / "vision-backups" / "db" / self.remote_dumps()[0]
        unpacked = self.unpack(tar)
        everything = b"".join(p.read_bytes() for p in unpacked.iterdir())
        for secret in (b"jira-secret-owner", b"jira-secret-qa", b"jira-secret-project", b"$2a$10$abcdefghij"):
            self.assertNotIn(secret, everything)
        users = (unpacked / "user.csv").read_text()
        self.assertIn("!restored", users)
        self.assertIn("KEY-OWNER-1", users)
        manifest = (unpacked / "manifest.txt").read_text()
        self.assertIn("Project=1", manifest)
        self.assertIn("User=2", manifest)

    def test_keeps_the_last_7_dumps_on_the_remote(self):
        folder = self.drive / "vision-backups" / "db"
        folder.mkdir(parents=True)
        for day in range(1, 10):
            (folder / f"vision-202610{day:02d}T031700Z.tar").write_bytes(b"old")
        self.assertEqual(self.backup().returncode, 0)
        dumps = self.remote_dumps()
        self.assertEqual(len(dumps), 7)
        self.assertNotIn("vision-20261001T031700Z.tar", dumps)
        self.assertNotIn("vision-20261003T031700Z.tar", dumps)

    def test_keeps_the_backup_locally_and_uploads_it_on_the_next_run(self):
        env = dict(self.env, FAKE_RCLONE_FAIL="1")
        done = self.backup(env=env)
        self.assertEqual(done.returncode, 3, done.stderr)
        self.assertIn("uploaded on the next run", done.stderr)
        local = sorted((self.data / "backups").glob("vision-*.tar"))
        self.assertEqual(len(local), 1)
        status = (self.data / "backup-status" / "status.json").read_text()
        self.assertIn('"lastSuccessAt": null', status)
        self.assertIn('"pendingUploads": 1', status)
        self.assertEqual(self.backup().returncode, 0)
        self.assertIn(local[0].name, self.remote_dumps())
        self.assertEqual(len(self.remote_dumps()), 2)

    def test_refuses_when_the_database_container_is_not_visions(self):
        env = dict(self.env, FAKE_CONFIG_FILES="/srv/vrt/docker-compose.yml")
        done = self.backup(env=env)
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("not Vision's own container", done.stderr)
        self.assertEqual(self.remote_dumps(), [])
        self.assertNotIn("pg_dump", self.log.read_text())

    def test_runs_rclone_from_its_docker_image_when_it_is_not_installed(self):
        image_only = self.tmp / "image-only"
        image_only.mkdir()
        (image_only / "docker").symlink_to(self.tmp / "bin" / "docker")
        (image_only / "crontab").symlink_to(self.tmp / "bin" / "crontab")
        config = self.tmp / "rclone-config"
        config.mkdir()
        (config / "rclone.conf").write_text("[fake]\ntype = drive\n")
        path = ":".join(p for p in os.environ["PATH"].split(":") if not (pathlib.Path(p) / "rclone").exists())
        env = dict(self.env, PATH=f"{image_only}:{path}", RCLONE_CONFIG_DIR=str(config),
                   FAKE_RCLONE_BIN=str(self.tmp / "bin" / "rclone"))
        done = self.backup(env=env)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertEqual(len(self.remote_dumps()), 1)
        calls = self.log.read_text()
        self.assertIn(f"-v {config}:/config/rclone", calls)
        self.assertIn("rclone/rclone:1.68.2 copyto", calls)

    def test_installs_a_cron_line_every_5_minutes_once(self):
        # the nightly line of the first version is replaced, other lines are kept
        (self.tmp / "crontab").write_text(
            "0 1 * * * /usr/bin/something\n17 3 * * * /srv/vision/scripts/vision-backup.sh >>x 2>&1 # vision-backup\n")
        for _ in range(2):
            self.assertEqual(self.backup("--install-cron").returncode, 0)
        lines = (self.tmp / "crontab").read_text().splitlines()
        self.assertEqual(len(lines), 2)
        self.assertEqual(lines[0], "0 1 * * * /usr/bin/something")
        self.assertTrue(lines[1].startswith("*/5 * * * * "))
        self.assertIn("vision-backup.sh --scheduled", lines[1])

    # ---- the Backups page (017) ----------------------------------------------------------

    def config(self):
        folder = self.data / "backup-config"
        folder.mkdir(exist_ok=True)
        return folder

    def local_tars(self):
        return sorted((self.data / "backups").glob("vision-*.tar"))

    def test_runs_a_requested_backup_once(self):
        import datetime
        (self.data / "backup-status").mkdir(exist_ok=True)
        (self.data / "backup-status" / "last-scheduled").write_text(datetime.date.today().isoformat() + "\n")
        request = self.config() / "backup-requested"
        request.write_text("2026-10-27T12:00:00Z\n")
        done = self.backup("--scheduled")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("asked for on the Backups page", done.stdout)
        self.assertFalse(request.exists())
        self.assertEqual(len(self.remote_dumps()), 1)
        status = (self.data / "backup-status" / "status.json").read_text()
        self.assertIn('"runningSince": null', status)
        # nothing asked and the daily one done: a quiet no-op
        done = self.backup("--scheduled")
        self.assertEqual((done.returncode, done.stdout), (0, ""))
        self.assertEqual(len(self.remote_dumps()), 1)

    def test_runs_the_daily_backup_once_after_its_time(self):
        (self.config() / "settings.json").write_text('{"time":"00:00","keep":7}\n')
        done = self.backup("--scheduled")
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("daily at 00:00", done.stdout)
        self.assertEqual(len(self.remote_dumps()), 1)
        self.assertEqual(self.backup("--scheduled").stdout, "")
        self.assertEqual(len(self.remote_dumps()), 1)

    def test_counts_any_backup_after_the_daily_time_as_the_daily_one(self):
        (self.config() / "settings.json").write_text('{"time":"00:00","keep":7}\n')
        request = self.config() / "backup-requested"
        request.write_text("now\n")
        self.assertIn("asked for on the Backups page", self.backup("--scheduled").stdout)
        done = self.backup("--scheduled")
        self.assertEqual((done.returncode, done.stdout), (0, ""))
        self.assertEqual(len(self.remote_dumps()), 1)

    def images_on_drive(self):
        folder = self.drive / "vision-backups" / "images"
        return sorted(str(p.relative_to(folder)) for p in folder.rglob("*") if p.is_file())

    def test_deletes_images_no_kept_backup_needs(self):
        images = self.data / "imageUploads"
        (images / "gone.png").write_bytes(b"deleted baseline")
        env = dict(self.env, BACKUP_KEEP="2")
        self.assertEqual(self.backup(env=env).returncode, 0)
        self.assertIn("gone.png", self.images_on_drive())
        # the baseline is deleted in Vision; while a kept backup lists it, Drive keeps it
        (images / "gone.png").unlink()
        (images / "new.png").write_bytes(b"new baseline")
        self.assertEqual(self.backup(env=env).returncode, 0)
        self.assertIn("gone.png", self.images_on_drive())
        # the backup that listed it is no longer kept: the image goes too
        done = self.backup(env=env)
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("Deleting 1 images", done.stdout)
        self.assertEqual(self.images_on_drive(), ["base.png", "new.png"])
        self.assertEqual(len(self.remote_dumps()), 2)
        lists = sorted(p.name for p in (self.drive / "vision-backups" / "db").glob("*.images.txt"))
        self.assertEqual(len(lists), 2)
        self.assertEqual((images / "base.png").read_bytes(), b"png-1", "local images are never touched")

    def test_keeps_old_images_while_a_kept_backup_has_no_list(self):
        old = self.drive / "vision-backups" / "db" / "vision-20261001T031700Z.tar"
        old.parent.mkdir(parents=True)
        old.write_bytes(b"made before lists")
        (self.drive / "vision-backups" / "images").mkdir(parents=True)
        (self.drive / "vision-backups" / "images" / "old.png").write_bytes(b"old")
        done = self.backup()
        self.assertEqual(done.returncode, 0, done.stderr)
        self.assertIn("has no list of images", done.stdout)
        self.assertIn("old.png", self.images_on_drive())

    def test_does_not_run_two_backups_at_once(self):
        lock = self.data / "backups" / ".lock"
        lock.mkdir(parents=True)
        (lock / "pid").write_text(str(os.getpid()))
        done = self.backup()
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("already running", done.stderr)
        request = self.config() / "backup-requested"
        request.write_text("now\n")
        done = self.backup("--scheduled")
        self.assertEqual(done.returncode, 0)
        self.assertTrue(request.exists(), "the request waits for the running backup")
        self.assertEqual(self.local_tars(), [])
        # a lock left by a process that is gone does not block
        (lock / "pid").write_text("999999")
        self.assertEqual(self.backup().returncode, 0)
        self.assertFalse(lock.exists())

    def test_uses_the_drive_connected_in_the_ui(self):
        config = self.config()
        (config / "rclone.conf").write_text("[vision-drive]\ntype = drive\nscope = drive.file\n")
        (config / "settings.json").write_text('{"time":"03:17","keep":2}\n')
        folder = self.drive / "vision-drive" / "db"
        folder.mkdir(parents=True)
        for day in range(1, 5):
            (folder / f"vision-202610{day:02d}T031700Z.tar").write_bytes(b"old")
        done = self.backup()
        self.assertEqual(done.returncode, 0, done.stderr)
        dumps = sorted(p.name for p in folder.glob("*.tar"))
        self.assertEqual(len(dumps), 2)
        self.assertNotIn("vision-20261003T031700Z.tar", dumps)
        self.assertTrue((self.drive / "vision-drive" / "images" / "base.png").exists())
        self.assertEqual(self.remote_dumps(), [], "BACKUP_REMOTE from .env.demo is not used")
        self.assertIn(f"config={config}/rclone.conf", self.log.read_text())

    # ---- restore -----------------------------------------------------------------------

    def restore_target(self):
        """A clean machine: an empty database and data folder, the same remote."""
        db = "vision_backup_test_restored"
        create_database(db, seed=False)
        data = self.tmp / "restored"
        env = dict(self.env, FAKE_CONTAINERS=f"visionpg:{db}",
                   VISION_ENV_FILE=str(self.write_env(db, data)))
        return db, data, env

    def test_restores_a_backup_into_an_empty_database(self):
        self.assertEqual(self.backup().returncode, 0)
        db, data, env = self.restore_target()
        done = self.run_script("vision-restore.sh", "--yes", env=env)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertEqual(psql(db, 'select name from "Project"'), "Android app")
        self.assertEqual(psql(db, 'select count(*) from "TestRun"'), "1")
        self.assertIn("clock", psql(db, 'select "uiTreeSettings" from "Project"'))
        self.assertEqual(psql(db, 'select "jiraToken" is null from "Project"'), "t")
        self.assertEqual((data / "imageUploads" / "base.png").read_bytes(), b"png-1")

    def test_restores_api_keys_unchanged(self):
        self.assertEqual(self.backup().returncode, 0)
        db, _, env = self.restore_target()
        self.assertEqual(self.run_script("vision-restore.sh", "--yes", env=env).returncode, 0)
        self.assertEqual(psql(db, """select string_agg("apiKey", ',' order by id) from "User" where id in ('u1', 'u2')"""),
                         "KEY-OWNER-1,KEY-QA-2")

    def test_makes_the_master_user_an_admin_existing_or_new(self):
        self.assertEqual(self.backup().returncode, 0)
        db, data, env = self.restore_target()
        self.assertEqual(self.run_script("vision-restore.sh", "--yes", env=env).returncode, 0)
        row = psql(db, """select role || ' ' || password from "User" where email = 'master@bank.test'""")
        role, password_hash = row.split(" ")
        self.assertEqual(role, "admin")
        self.assertTrue(self.password_matches(MASTER_PASSWORD, password_hash))
        # an existing user named as the master keeps their id and API key and becomes an admin
        env["VISION_ENV_FILE"] = str(self.write_env(db, data).with_name("env-existing"))
        pathlib.Path(env["VISION_ENV_FILE"]).write_text(
            self.write_env(db, data).read_text().replace("master@bank.test", "qa@bank.test"))
        self.assertEqual(self.run_script("vision-restore.sh", "--yes", env=env).returncode, 0)
        self.assertEqual(psql(db, """select role || ' ' || "apiKey" from "User" where email = 'qa@bank.test'"""),
                         "admin KEY-QA-2")
        self.assertEqual(psql(db, 'select count(*) from "User"'), "2")

    def test_other_users_cannot_log_in_with_a_password_after_a_restore(self):
        self.assertEqual(self.backup().returncode, 0)
        db, _, env = self.restore_target()
        self.assertEqual(self.run_script("vision-restore.sh", "--yes", env=env).returncode, 0)
        password_hash = psql(db, """select password from "User" where id = 'u1'""")
        self.assertEqual(password_hash, "!restored")
        self.assertFalse(self.password_matches("", password_hash))
        self.assertFalse(self.password_matches("!restored", password_hash))

    def test_refuses_a_master_password_shorter_than_12_characters(self):
        self.assertEqual(self.backup().returncode, 0)
        db, data, env = self.restore_target()
        short = self.write_env(db, data).read_text().replace(MASTER_PASSWORD, "short-pass")
        pathlib.Path(env["VISION_ENV_FILE"]).write_text(short)
        done = self.run_script("vision-restore.sh", "--yes", env=env)
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("at least 12 characters", done.stderr)
        self.assertEqual(psql(db, "select count(*) from information_schema.tables where table_schema = 'public'"), "0")

    def password_matches(self, password, password_hash):
        code = "require('bcryptjs').compare(process.argv[1], process.argv[2]).then((ok) => console.log(ok))"
        done = subprocess.run(["node", "-e", code, password, password_hash], capture_output=True, text=True,
                              env=dict(os.environ, NODE_PATH=str(NODE_MODULES)))
        return done.stdout.strip() == "true"

    # ---- copy from production ------------------------------------------------------------

    def clone_from_prod(self, env):
        create_database("vision_backup_test_prod")
        psql("vision_backup_test_prod", """UPDATE "Project" SET name = 'Android app (prod)'""")
        prod_images = self.tmp / "prod-images"
        prod_images.mkdir(exist_ok=True)
        env = dict(env, VISION_ENV_FILE=str(self.write_env(
            self.db, self.data, f"PROD_PG_CONTAINER=prodpg\nPROD_IMAGES_DIR={prod_images}\n")))
        return self.run_script("demo-clone-from-prod.sh", "--yes", env=env)

    def test_backs_up_before_a_production_copy_replaces_visions_data(self):
        done = self.clone_from_prod(self.env)
        self.assertEqual(done.returncode, 0, done.stdout + done.stderr)
        self.assertIn("Backing up Vision's current data", done.stdout)
        tar = self.drive / "vision-backups" / "db" / self.remote_dumps()[0]
        self.assertIn("Android app", (self.unpack(tar) / "project.csv").read_text())
        self.assertNotIn("(prod)", (self.unpack(tar) / "project.csv").read_text())
        self.assertEqual(psql(self.db, 'select name from "Project"'), "Android app (prod)")

    def test_replaces_nothing_when_the_backup_before_a_production_copy_fails(self):
        done = self.clone_from_prod(dict(self.env, FAKE_FAIL_PG_DUMP="visionpg"))
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("nothing was replaced", done.stderr)
        self.assertEqual(psql(self.db, 'select name from "Project"'), "Android app")


if __name__ == "__main__":
    unittest.main()
