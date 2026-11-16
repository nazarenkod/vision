"""Tests for scripts/seed-insights-demo.py.

    python3 -I scripts/tests/test_seed_insights_demo.py

A fake Vision API runs on a local port. The date-moving SQL runs on a local
Postgres when one is reachable as the postgres user; otherwise those tests are skipped.
"""
import importlib.util
import io
import json
import os
import shutil
import struct
import subprocess
import sys
import threading
import unittest
import uuid
import xml.etree.ElementTree as ET
import zlib
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "seed-insights-demo.py"


def load():
    spec = importlib.util.spec_from_file_location("seed_insights_demo", SCRIPT)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


seed = load()


class FakeApi:
    """Records every request; is_vision=False answers like the production VRT (404)."""

    def __init__(self, is_vision=True):
        self.calls = []
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def reply(self, code, body):
                data = json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(data)

            def handle_any(self):
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length)) if length else None
                fake.calls.append((self.command, self.path, body))
                path = self.path.split("?")[0]
                if path == "/users/accounts/enabled" and fake.is_vision:
                    return self.reply(200, True)
                if not fake.is_vision:
                    return self.reply(404, {"message": f"Cannot {self.command} {path}"})
                if path == "/users/login":
                    # since 044 the API key never comes back after sign-in
                    return self.reply(201, {"token": "jwt"})
                if path == "/projects" and self.command == "GET":
                    return self.reply(200, [])
                if path == "/projects":
                    return self.reply(201, {"id": str(uuid.uuid4()), "name": body["name"]})
                if path == "/builds":
                    return self.reply(201, {"id": str(uuid.uuid4()), "projectId": body["project"]})
                if path == "/test-runs":
                    return self.reply(201, {"id": str(uuid.uuid4()), "status": "ok"})
                return self.reply(200, {})

            do_GET = do_POST = do_PATCH = handle_any

        self.is_vision = is_vision
        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = f"http://127.0.0.1:{self.server.server_port}"

    def close(self):
        self.server.shutdown()
        self.server.server_close()


def run_main(args, env_password="secret", env_key="key"):
    out, err = io.StringIO(), io.StringIO()
    saved = sys.argv
    sys.argv = ["seed-insights-demo.py", *args]
    os.environ["VISION_PASSWORD"] = env_password
    if env_key:
        os.environ["VISION_API_KEY"] = env_key
    else:
        os.environ.pop("VISION_API_KEY", None)
    try:
        with redirect_stdout(out), redirect_stderr(err):
            seed.main()
        code = 0
    except SystemExit as stop:
        code = stop.code
    finally:
        sys.argv = saved
    return code, out.getvalue() + (code if isinstance(code, str) else "")


class PureParts(unittest.TestCase):
    def test_draws_a_png_of_the_asked_size(self):
        data = seed.png(30, 20, [(5, 5, 10, 10, (255, 0, 0))])
        self.assertEqual(data[:8], b"\x89PNG\r\n\x1a\n")
        width, height = struct.unpack(">II", data[16:24])
        self.assertEqual((width, height), (30, 20))
        idat = data[data.index(b"IDAT") + 4:data.index(b"IEND") - 8]
        raw = zlib.decompress(idat)
        self.assertEqual(len(raw), 20 * (1 + 30 * 3))
        row = raw[7 * 91 + 1:8 * 91]
        self.assertEqual(row[5 * 3:5 * 3 + 3], bytes((255, 0, 0)))

    def test_gives_each_screen_the_accessibility_problems_it_promises(self):
        screen = {"name": "Перекази", "a11y": (4, 2, True)}
        _, elements = seed.screen_layout(screen, 0)
        root = ET.fromstring(seed.ui_tree(elements).encode())
        buttons = [n for n in root.iter() if n.get("class") == "android.widget.ImageButton"]
        unlabeled = [n for n in buttons if not n.get("content-desc")]
        self.assertEqual(len(unlabeled), 4)
        self.assertEqual(len(buttons) - len(unlabeled), 2)
        self.assertEqual(sum(1 for n in root.iter() if n.get("content-desc") == "Детальніше"), 2)

    def test_changes_only_the_banner_between_looks(self):
        screen = {"name": "Акції", "a11y": (0, 0, False)}
        before, _ = seed.screen_layout(screen, 0)
        after, _ = seed.screen_layout(screen, 1)
        self.assertEqual([r for r in before if r not in after], [before[1]])

    def test_runs_stale_screens_only_in_the_old_build_and_leaves_one_never_approved(self):
        old = {(s["name"], d) for s, d, _, _, _ in seed.runs_of_build(0)}
        for k in range(1, seed.BUILDS + 1):
            names = {s["name"] for s, _, _, _, _ in seed.runs_of_build(k)}
            self.assertNotIn("Онбординг v1", names)
            self.assertIn("Курси валют", names)
        self.assertIn(("Онбординг v1", "Pixel 7"), old)
        undecided = [s["name"] for s, _, _, _, decision in seed.runs_of_build(0) if decision is None]
        self.assertEqual(undecided, ["Депозити (старий екран)"])

    def test_keeps_an_approved_look_so_it_does_not_count_as_a_flip(self):
        looks = [seed.runs_of_build(k) for k in range(1, seed.BUILDS + 1)]
        cashback = [next(r for r in build if r[0]["name"] == "Кешбек")[3] for build in looks]
        self.assertEqual(cashback, [0, 0, 1, 1, 1, 2, 2, 2])

    def test_refuses_anything_but_ids_in_the_sql(self):
        project = str(uuid.uuid4())
        with self.assertRaises(ValueError):
            seed.backdate_sql(project, [(str(uuid.uuid4()), 2, ["x'; DROP TABLE \"Build\"; --"])])
        with self.assertRaises(ValueError):
            seed.backdate_sql("not-a-project", [])

    def test_ties_every_moved_row_to_the_project_or_to_the_runs_it_made(self):
        project, build, run = (str(uuid.uuid4()) for _ in range(3))
        sql = seed.backdate_sql(project, [(build, 120, [run])])
        for line in sql.splitlines():
            if line.startswith("UPDATE"):
                self.assertTrue(f"'{project}'" in line or f"'{run}'" in line, line)
        self.assertNotRegex(sql, r"(?i)\b(delete|drop|truncate)\b")


class TalkingToTheApi(unittest.TestCase):
    def test_writes_nothing_when_the_api_is_not_vision(self):
        api = FakeApi(is_vision=False)
        try:
            code, output = run_main(["--email", "a@b.c", "--api", api.url, "--yes", "--no-backdate"])
        finally:
            api.close()
        self.assertNotEqual(code, 0)
        self.assertIn("is not Vision", output)
        self.assertEqual([c for c in api.calls if c[0] != "GET"], [])

    def test_sends_every_screen_and_the_decisions_of_the_plan(self):
        api = FakeApi()
        try:
            code, _ = run_main(["--email", "a@b.c", "--api", api.url, "--yes", "--no-backdate"])
        finally:
            api.close()
        self.assertEqual(code, 0)
        runs = [c for c in api.calls if c[1] == "/test-runs"]
        expected = sum(len(seed.runs_of_build(k)) for k in range(seed.BUILDS + 1))
        self.assertEqual(len(runs), expected)
        self.assertTrue(all(c[2]["uiTree"] and c[2]["deviceDensity"] == seed.DENSITY for c in runs))
        builds = [c for c in api.calls if c[1] == "/builds"]
        self.assertEqual(len(builds), seed.BUILDS + 1)
        approvals = [c for c in api.calls if c[1].startswith("/test-runs/approve")]
        rejections = [c for c in api.calls if c[1] == "/test-runs/reject"]
        self.assertEqual(sum(len(c[2]) for c in approvals), 15 + 2 + 2)
        self.assertEqual(sum(len(c[2]) for c in rejections), 1)
        created = [c for c in api.calls if c[0] == "POST" and c[1] == "/projects"]
        self.assertEqual(created[0][2]["name"], "Insights demo")

    def test_asks_for_the_api_key_and_writes_nothing_without_it(self):
        fake = FakeApi()
        try:
            code, out = run_main(["--email", "a@b.c", "--api", fake.url, "--yes", "--no-backdate"], env_key="")
        finally:
            fake.close()
        self.assertIn("VISION_API_KEY", str(code))
        self.assertFalse([c for c in fake.calls if c[1] in ("/projects", "/builds", "/test-runs")])

    def test_stops_without_writing_unless_told_yes(self):
        api = FakeApi()
        saved = sys.stdin
        sys.stdin = io.StringIO("no\n")
        try:
            code, output = run_main(["--email", "a@b.c", "--api", api.url, "--no-backdate"])
        finally:
            sys.stdin = saved
            api.close()
        self.assertIn("nothing was written", output)
        self.assertEqual([c for c in api.calls if c[0] != "GET"], [])


def local_postgres():
    if not shutil.which("psql"):
        return False
    done = subprocess.run(["psql", "-U", "postgres", "-h", "localhost", "-c", "select 1"],
                          capture_output=True, env={"PGPASSWORD": "postgres", "PATH": "/usr/bin:/bin"})
    return done.returncode == 0


@unittest.skipUnless(local_postgres(), "no local Postgres as postgres/postgres")
class MovingTheDates(unittest.TestCase):
    ENV = {"PGPASSWORD": "postgres", "PATH": "/usr/bin:/bin"}

    def psql(self, sql, db=None):
        return subprocess.run(["psql", "-q", "-At", "-U", "postgres", "-h", "localhost", "-d", db or self.db],
                              input=sql, text=True, capture_output=True, env=self.ENV)

    def setUp(self):
        self.db = "seed_test_" + uuid.uuid4().hex[:8]
        self.psql(f"CREATE DATABASE {self.db}", db="postgres")
        self.psql("""
            CREATE TABLE "Project" (id text PRIMARY KEY);
            CREATE TABLE "Build" (id text PRIMARY KEY, "projectId" text, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
            CREATE TABLE "TestVariation" (id text PRIMARY KEY, "projectId" text, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
            CREATE TABLE "TestRun" (id text PRIMARY KEY, "projectId" text, "testVariationId" text, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
            CREATE TABLE "Baseline" (id text PRIMARY KEY, "testRunId" text, "createdAt" timestamptz DEFAULT now(), "updatedAt" timestamptz DEFAULT now());
        """)

    def tearDown(self):
        self.psql(f"DROP DATABASE IF EXISTS {self.db}", db="postgres")

    def ids(self, n):
        return [str(uuid.uuid4()) for _ in range(n)]

    def test_moves_only_the_rows_this_run_made(self):
        project, other, build, other_build, run, other_run, variation = self.ids(7)
        self.psql(f"""
            INSERT INTO "Project" VALUES ('{project}'), ('{other}');
            INSERT INTO "Build" (id, "projectId") VALUES ('{build}', '{project}'), ('{other_build}', '{project}');
            INSERT INTO "TestVariation" (id, "projectId") VALUES ('{variation}', '{project}');
            INSERT INTO "TestRun" (id, "projectId", "testVariationId") VALUES
              ('{run}', '{project}', '{variation}'), ('{other_run}', '{other}', '{variation}');
            INSERT INTO "Baseline" (id, "testRunId") VALUES ('b1', '{run}'), ('b2', '{other_run}');
        """)
        done = self.psql(seed.backdate_sql(project, [(build, 120, [run])]))
        self.assertEqual(done.returncode, 0, done.stderr)
        age = """SELECT round(extract(epoch FROM now() - "createdAt") / 86400) FROM "{}" WHERE id = '{}'"""
        days = lambda table, row: self.psql(age.format(table, row)).stdout.strip()  # noqa: E731
        self.assertEqual(days("Build", build), "120")
        self.assertEqual(days("TestRun", run), "120")
        self.assertEqual(days("TestVariation", variation), "120")
        self.assertEqual(days("Build", other_build), "0")
        self.assertEqual(days("TestRun", other_run), "0")
        self.assertEqual(days("Baseline", "b2"), "0")

    def test_changes_nothing_when_the_project_is_not_in_this_database(self):
        project, build, run = self.ids(3)
        self.psql(f"""INSERT INTO "Build" (id, "projectId") VALUES ('{build}', '{project}');""")
        done = self.psql(seed.backdate_sql(project, [(build, 120, [run])]))
        self.assertNotEqual(done.returncode, 0)
        self.assertIn("not in this database", done.stderr)
        age = self.psql(f"""SELECT round(extract(epoch FROM now() - "createdAt") / 86400) FROM "Build" WHERE id = '{build}'""")
        self.assertEqual(age.stdout.strip(), "0")


if __name__ == "__main__":
    unittest.main()
