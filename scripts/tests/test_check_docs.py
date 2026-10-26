"""Tests for scripts/check-docs.py on small made-up repositories.

    python3 -I scripts/tests/test_check_docs.py
"""
import importlib.util
import pathlib
import tempfile
import textwrap
import unittest

SCRIPT = pathlib.Path(__file__).resolve().parents[1] / "check-docs.py"
spec = importlib.util.spec_from_file_location("check_docs", SCRIPT)
check_docs = importlib.util.module_from_spec(spec)
spec.loader.exec_module(check_docs)

ADR = """# ADR-0001: X

| | |
|---|---|
| Статус | Accepted |

## Контекст
## Розглянуті варіанти
## Рішення
## Наслідки
## Як перевіряємо
"""


def spec_md(status="Implemented", reqs=("REQ-001-01",)):
    rows = "\n".join(f"| {r} | US-1 | СИСТЕМА ПОВИННА … |" for r in reqs)
    return f"# 001\n\n| | |\n|---|---|\n| Статус | {status} |\n\n## Вимоги\n\n| ID | Історія | Вимога |\n|---|---|---|\n{rows}\n"


class CheckDocsTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.root = pathlib.Path(self.tmp.name)
        self.write("docs/decisions/README.md", "| [ADR-0001](0001-x.md) |\n")
        self.write("docs/decisions/0001-x.md", ADR)
        self.write("docs/specs/README.md", "| [001](001-a/spec.md) | A | Implemented |\n")
        self.write("backend/src/a.spec.ts", "it('does the thing', () => {})\n")

    def tearDown(self):
        self.tmp.cleanup()

    def write(self, path, text):
        file = self.root / path
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text(textwrap.dedent(text), encoding="utf-8")

    def problems(self):
        return check_docs.check_links(self.root) + check_docs.check_specs(self.root) + check_docs.check_adrs(self.root)

    def test_accepts_a_spec_whose_every_requirement_is_traced_to_a_test_that_exists(self):
        self.write("docs/specs/001-a/spec.md", spec_md())
        self.write("docs/specs/001-a/design.md", "| REQ-001-01 | `backend/src/a.spec.ts › does the thing` |\n")
        self.assertEqual(self.problems(), [])

    def test_finds_untraced_requirements_missing_tests_and_renamed_tests(self):
        self.write("docs/specs/001-a/spec.md", spec_md(reqs=("REQ-001-01", "REQ-001-02")))
        self.write(
            "docs/specs/001-a/design.md",
            "| REQ-001-01 | `backend/src/a.spec.ts › does another thing`; `backend/src/gone.spec.ts › x` |\n",
        )
        found = "\n".join(self.problems())
        self.assertIn("REQ-001-02 is not traced", found)
        self.assertIn("no test named “does another thing”", found)
        self.assertIn("no such test file backend/src/gone.spec.ts", found)

    def test_finds_broken_links_wrong_statuses_and_foreign_ids(self):
        self.write("docs/specs/001-a/spec.md", spec_md(status="Done", reqs=("REQ-002-01",)) + "[x](nowhere.md)\n")
        self.write("docs/specs/001-a/design.md", "| REQ-002-01 | manual: … |\n")
        found = "\n".join(self.problems())
        self.assertIn("broken link nowhere.md", found)
        self.assertIn("unknown status 'Done'", found)
        self.assertIn("REQ-002-01 belongs to another spec", found)

    def test_lets_a_draft_go_without_a_design_and_name_files_still_to_be_written(self):
        self.write("docs/specs/README.md", "| [001](001-a/spec.md) | A | Draft |\n")
        self.write("docs/specs/001-a/spec.md", spec_md(status="Draft"))
        self.assertEqual(self.problems(), [])
        self.write("docs/specs/001-a/design.md", "Скрипт `scripts/not-yet.sh`.\n")
        self.assertEqual(self.problems(), [])

    def test_wants_the_index_to_list_every_spec_with_its_status(self):
        self.write("docs/specs/README.md", "| [001](001-a/spec.md) | A | Draft |\n")
        self.write("docs/specs/001-a/spec.md", spec_md())
        self.write("docs/specs/001-a/design.md", "| REQ-001-01 | manual: … |\n")
        self.assertIn("another status for 001-a", "\n".join(self.problems()))

    def test_wants_adrs_to_have_their_sections_and_a_place_in_the_index(self):
        self.write("docs/decisions/0002-y.md", "# ADR-0002\n\n| Статус | Accepted |\n\n## Контекст\n")
        found = "\n".join(self.problems())
        self.assertIn("no “Розглянуті варіанти” section", found)
        self.assertIn("does not list 0002-y.md", found)


if __name__ == "__main__":
    unittest.main(verbosity=2)
