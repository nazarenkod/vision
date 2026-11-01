"""Tests for the pure parts of scripts/verify.py: known tsc errors, migrations, changed files.

    python3 -I scripts/tests/test_verify.py
"""
import collections
import importlib.util
import pathlib
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "verify.py"
spec = importlib.util.spec_from_file_location("verify", SCRIPT)
verify = importlib.util.module_from_spec(spec)
spec.loader.exec_module(verify)

TSC = """\
src/a.ts(10,5): error TS2741: Property 'updatedAt' is missing in type 'X'.
src/a.ts(20,5): error TS2741: Property 'updatedAt' is missing in type 'X'.
src/b.tsx(3,1): error TS2322: Type 'string' is not assignable to type 'number'.
Found 3 errors in 2 files.
"""


class TscBaselineTest(unittest.TestCase):
    def test_a_known_error_that_moved_to_another_line_is_not_new(self):
        baseline = verify.tsc_errors(TSC)
        moved = verify.tsc_errors(TSC.replace("(10,5)", "(14,5)"))
        self.assertEqual(verify.compare_with_baseline(moved, baseline), ([], []))

    def test_reports_a_new_error_by_file_and_code(self):
        baseline = verify.tsc_errors(TSC)
        current = verify.tsc_errors(TSC + "src/c.ts(1,1): error TS2304: Cannot find name 'x'.\n")
        new, fixed = verify.compare_with_baseline(current, baseline)
        self.assertEqual(new, ["src/c.ts: TS2304"])
        self.assertEqual(fixed, [])

    def test_one_more_copy_of_a_known_error_is_new(self):
        # the same message twice in a file is two errors: a third one must not hide among them
        baseline = verify.tsc_errors(TSC)
        current = verify.tsc_errors(TSC + "src/a.ts(30,5): error TS2741: Property 'updatedAt' is missing in type 'X'.\n")
        new, _ = verify.compare_with_baseline(current, baseline)
        self.assertEqual(new, ["src/a.ts: TS2741"])

    def test_reports_known_errors_that_were_fixed(self):
        baseline = verify.tsc_errors(TSC)
        current = verify.tsc_errors(TSC.splitlines()[0])
        new, fixed = verify.compare_with_baseline(current, baseline)
        self.assertEqual(new, [])
        self.assertEqual(len(fixed), 2)

    def test_a_known_error_whose_type_prints_its_fields_in_another_order_is_not_new(self):
        baseline = verify.tsc_errors("src/s.ts(1,1): error TS2345: Argument of type '{ a: string; b: Date }'.\n")
        current = verify.tsc_errors("src/s.ts(1,1): error TS2345: Argument of type '{ b: Date; a: string }'.\n")
        self.assertEqual(verify.compare_with_baseline(current, baseline), ([], []))

    def test_shows_the_full_lines_of_new_errors(self):
        lines = verify.tsc_lines(TSC, {"src/b.tsx: TS2322"})
        self.assertEqual(lines, ["src/b.tsx(3,1): error TS2322: Type 'string' is not assignable to type 'number'."])

    def test_ignores_lines_that_are_not_errors(self):
        self.assertEqual(verify.tsc_errors("Found 3 errors in 2 files.\n"), collections.Counter())


class MigrationTest(unittest.TestCase):
    def test_lets_additive_migrations_through(self):
        sql = 'ALTER TABLE "Project" ADD COLUMN "allowedDevices" JSONB;\nCREATE INDEX "i" ON "A"("b");\n'
        self.assertEqual(verify.destructive_statements(sql), [])

    def test_finds_drops_renames_enum_changes_and_not_null(self):
        sql = "\n".join([
            'ALTER TABLE "A" DROP COLUMN "b";',
            'ALTER TABLE "A" RENAME COLUMN "b" TO "c";',
            'ALTER TYPE "Role" ADD VALUE \'x\';',
            'ALTER TABLE "A" ALTER COLUMN "b" SET NOT NULL;',
        ])
        self.assertEqual(len(verify.destructive_statements(sql)), 4)

    def test_a_comment_that_explains_why_nothing_is_dropped_does_not_count(self):
        sql = '-- safe: nothing to drop, only a new nullable column\nALTER TABLE "A" ADD COLUMN "b" TEXT;\n'
        self.assertEqual(verify.destructive_statements(sql), [])


class ChangedFilesTest(unittest.TestCase):
    def test_lints_only_script_files_of_the_package_relative_to_it(self):
        files = ["backend/src/a.ts", "backend/README.md", "frontend/src/b.tsx", "docs/x.md"]
        self.assertEqual(verify.lint_targets(files, "backend"), ["src/a.ts"])
        self.assertEqual(verify.lint_targets(files, "frontend"), ["src/b.tsx"])

    def test_checks_only_migration_files(self):
        files = ["backend/prisma/migrations/20261030_x/migration.sql", "backend/prisma/schema.prisma"]
        self.assertEqual(verify.new_migrations(files), ["backend/prisma/migrations/20261030_x/migration.sql"])


if __name__ == "__main__":
    unittest.main()
