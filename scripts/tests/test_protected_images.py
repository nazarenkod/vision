"""No stored image is served past the signature check (spec 043, REQ-043-05).

    python3 -I scripts/tests/test_protected_images.py

The API serves images only through /images with a signature. Neither the API nor the web server of
the interface may serve the folder of stored files as it is, and the interface container does not
even have it.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


def compose_service(name):
    """The lines of one service in docker-compose.demo.yml, up to the next one."""
    text = (ROOT / "docker-compose.demo.yml").read_text(encoding="utf-8")
    match = re.search(rf"^  {name}:\n((?:    .*\n|\s*\n)*)", text, re.M)
    if not match:
        raise AssertionError(f"no service {name} in docker-compose.demo.yml")
    return match.group(1)


class ProtectedImagesTest(unittest.TestCase):
    def test_serves_no_stored_file_past_the_checks(self):
        main = (ROOT / "backend" / "src" / "main.ts").read_text(encoding="utf-8")
        self.assertNotIn("useStaticAssets", main)
        self.assertNotRegex(main, r"express\.static|serve-static")

        nginx = (ROOT / "frontend" / "nginx" / "default.conf").read_text(encoding="utf-8")
        # the old address is closed rather than answered with the app's page
        self.assertRegex(nginx, r"location /static/imageUploads/ \{\s*return 404;\s*\}")
        self.assertNotIn("imageUploads", compose_service("ui"))
        self.assertIn("imageUploads", compose_service("api"))

        dockerfile = (ROOT / "frontend" / "Dockerfile").read_text(encoding="utf-8")
        self.assertNotIn("imageUploads", dockerfile)


if __name__ == "__main__":
    unittest.main()
