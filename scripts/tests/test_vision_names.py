"""Defaults and examples carry the name Vision, not VRT (spec 041, REQ-041-08).

    python3 -I scripts/tests/test_vision_names.py

What a new installation starts from: package names, compose defaults, example settings, the UI's
settings and texts, the Dockerfiles. Only the description of the production VRT Vision copies from
may name VRT.
"""
import json
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]
FILES = [
    "docker-compose.demo.yml", ".env.demo.example",
    "backend/.env.example", "backend/Dockerfile", "backend/prisma/Dockerfile",
    "backend/docker-compose.yml", "backend/docker-compose.ldap.yml", "backend/docker-compose.oidc.yml",
    "frontend/Dockerfile", "frontend/env.defaults", "frontend/src/i18n/en.ts", "frontend/src/i18n/uk.ts",
]
VRT = re.compile(r"visual.?regression.?tracker|\bVRT\b|VRT_|\bvrt[_-]|vrt\.json", re.I)
# the running production VRT is a real system Vision copies from: naming it is right
SOURCE = re.compile(r"production VRT|VRT's database|робоч\w* VRT|PROD_")


class VisionNamesTest(unittest.TestCase):
    def test_defaults_and_examples_name_no_vrt(self):
        found = []
        for name in FILES:
            for number, line in enumerate((ROOT / name).read_text(encoding="utf-8").splitlines(), 1):
                if VRT.search(line) and not SOURCE.search(line):
                    found.append(f"{name}:{number}: {line.strip()}")
        self.assertEqual(found, [])

    def test_packages_are_named_vision(self):
        for name in ("backend", "backend/prisma", "frontend"):
            package = json.loads((ROOT / name / "package.json").read_text(encoding="utf-8"))
            self.assertTrue(package["name"].startswith("vision-"), f"{name}: {package['name']}")


if __name__ == "__main__":
    unittest.main()
