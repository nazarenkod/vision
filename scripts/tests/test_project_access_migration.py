"""The migration that brings access to projects keeps what everyone saw (spec 042, REQ-042-10).

    python3 -I scripts/tests/test_project_access_migration.py

On a database of the version before it, with people and projects, the migration gives every
person every project, and nothing more: a project made afterwards is reached by whom it is
given to only. Needs a local PostgreSQL reachable as the postgres user (as in a throwaway
container); without one the test is skipped.
"""
import pathlib
import shutil
import subprocess
import unittest
import uuid

ROOT = pathlib.Path(__file__).resolve().parents[2]
MIGRATIONS = ROOT / "backend" / "prisma" / "migrations"
ACCESS = "20261105130000_add_project_access"
PAIRS = """SELECT string_agg("userId" || ':' || "projectId", ',' ORDER BY 1) FROM "ProjectAccess";"""


def psql(db, sql, check=True):
    done = subprocess.run(["runuser", "-u", "postgres", "--", "psql", "-X", "-q", "-tA", "-v", "ON_ERROR_STOP=1", "-d", db],
                          input=sql, capture_output=True, text=True, cwd="/tmp")
    if check and done.returncode:
        raise AssertionError(done.stderr)
    return done.stdout.strip()


def postgres_available():
    if not shutil.which("runuser") or not shutil.which("psql"):
        return False
    try:
        return psql("postgres", "select 1", check=False) == "1"
    except OSError:
        return False


@unittest.skipUnless(postgres_available(), "needs a local PostgreSQL reachable as the postgres user")
class ProjectAccessMigrationTest(unittest.TestCase):
    def test_gives_everyone_every_project_once(self):
        db = f"access_{uuid.uuid4().hex[:12]}"
        psql("postgres", f'CREATE DATABASE "{db}";')
        folders = sorted(p for p in MIGRATIONS.iterdir() if p.is_dir())
        before = [folder for folder in folders if folder.name < ACCESS]
        for folder in before:
            psql(db, (folder / "migration.sql").read_text())
        psql(db, '''
            INSERT INTO "User" (id, email, password, "apiKey", role, "updatedAt") VALUES
              ('u1', 'admin@bank.test', 'x', 'k1', 'admin', now()),
              ('u2', 'qa@bank.test', 'x', 'k2', 'editor', now()),
              ('u3', 'guest@bank.test', 'x', 'k3', 'guest', now());
            INSERT INTO "Project" (id, name, "updatedAt") VALUES ('p1', 'Android', now()), ('p2', 'iOS', now());
        ''')

        psql(db, (MIGRATIONS / ACCESS / "migration.sql").read_text())

        self.assertEqual(psql(db, PAIRS), "u1:p1,u1:p2,u2:p1,u2:p2,u3:p1,u3:p2")
        # what comes later is given, not inherited
        psql(db, '''INSERT INTO "Project" (id, name, "updatedAt") VALUES ('p3', 'Web', now());''')
        self.assertEqual(psql(db, '''SELECT count(*) FROM "ProjectAccess" WHERE "projectId" = 'p3';'''), "0")
        # the rows go with the project and with the person
        psql(db, '''DELETE FROM "Project" WHERE id = 'p2'; DELETE FROM "User" WHERE id = 'u3';''')
        self.assertEqual(psql(db, PAIRS), "u1:p1,u2:p1")


if __name__ == "__main__":
    unittest.main()
