"""Code patterns a bank's SAST (Fortify) reports stay out of the shipped code (082).

    python3 -I scripts/tests/test_scanner_findings.py

Each pattern was fixed once; this keeps it from coming back unnoticed.
"""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SHIPPED = [
    "backend/src",
    "backend/prisma",
    "frontend/src",
    "frontend/public/cli",
    "sdk-playwright/src",
    "sdk-java/src/main",
    "web-tree",
]
SKIP_DIRS = {"node_modules", "dist", "build", "__fixtures__", "__snapshots__"}
SUFFIXES = {".ts", ".tsx", ".js", ".cjs", ".mjs", ".java", ".py"}

# "Weak Cryptographic Hash": scanners do not tell an id from a signature
WEAK_HASH = re.compile(
    r"""createHash\(\s*['"](?:sha1|md5)['"]|hashlib\.(?:sha1|md5)\(|MessageDigest\.getInstance\(\s*"(?:SHA-?1|MD5)"\s*\)""",
    re.IGNORECASE,
)
# "Poor Error Handling: Empty Catch Block"
EMPTY_CATCH = re.compile(r"catch\s*(?:\([^)]*\))?\s*\{\s*\}|\.catch\(\s*\(\)\s*=>\s*\{\s*\}\s*\)")
EMPTY_EXCEPT = re.compile(r"^\s*except\b[^\n]*:\s*\n\s*pass\s*$", re.MULTILINE)
# "Password Management: Hardcoded Password": a password used when none is configured
FALLBACK_PASSWORD = re.compile(r"""PASSWORD\s*(?:\|\||\?\?)\s*['"][^'"]+['"]""")


def shipped_files():
    for top in SHIPPED:
        for path in sorted((ROOT / top).rglob("*")):
            if path.suffix not in SUFFIXES or not path.is_file():
                continue
            if SKIP_DIRS.intersection(path.relative_to(ROOT).parts):
                continue
            yield path


def matches(pattern, *, python=None):
    found = []
    for path in shipped_files():
        if python is not None and (path.suffix == ".py") != python:
            continue
        text = path.read_text(encoding="utf-8", errors="replace")
        for match in pattern.finditer(text):
            line = text.count("\n", 0, match.start()) + 1
            found.append(f"{path.relative_to(ROOT)}:{line}: {match.group(0).strip()[:60]}")
    return found


class ScannerFindings(unittest.TestCase):
    def test_scans_the_shipped_code(self):
        names = {path.relative_to(ROOT).as_posix() for path in shipped_files()}
        self.assertIn("backend/src/a11y/a11y-problems.ts", names)
        self.assertIn("frontend/public/cli/vision.py", names)
        self.assertIn("backend/prisma/seed.ts", names)

    def test_uses_no_sha1_or_md5(self):
        self.assertEqual(matches(WEAK_HASH), [])

    def test_leaves_no_catch_block_empty(self):
        self.assertEqual(matches(EMPTY_CATCH, python=False), [])

    def test_leaves_no_python_except_empty(self):
        self.assertEqual(matches(EMPTY_EXCEPT, python=True), [])

    def test_has_no_fallback_password(self):
        self.assertEqual(matches(FALLBACK_PASSWORD), [])

    def test_patterns_find_what_they_guard_against(self):
        self.assertTrue(WEAK_HASH.search("createHash('sha1')"))
        self.assertTrue(WEAK_HASH.search('MessageDigest.getInstance("MD5")'))
        self.assertTrue(EMPTY_CATCH.search("} catch {}"))
        self.assertTrue(EMPTY_CATCH.search("} catch (e) {\n  }"))
        self.assertTrue(EMPTY_CATCH.search(".catch(() => {})"))
        self.assertTrue(EMPTY_EXCEPT.search("    except OSError:\n        pass\n"))
        self.assertFalse(EMPTY_EXCEPT.search("class VisionError(Exception):\n    pass\n"))
        self.assertTrue(FALLBACK_PASSWORD.search("process.env.DEFAULT_USER_PASSWORD || '123456'"))


if __name__ == "__main__":
    unittest.main()
