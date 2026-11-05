"""Deployment settings for sign-in and the security headers (spec 045).

    python3 -I scripts/tests/test_api_hardening.py

The API in docker-compose.demo.yml gets every LDAP and SSO setting the API reads, and the
interface's nginx sends the same security headers as the API.
"""
import pathlib
import re
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[2]


def api_environment():
    text = (ROOT / "docker-compose.demo.yml").read_text(encoding="utf-8")
    service = re.search(r"^  api:\n((?:    .*\n|\s*\n)*)", text, re.M).group(1)
    return set(re.findall(r"^      ([A-Z][A-Z0-9_]*):", service, re.M))


class ApiHardeningTest(unittest.TestCase):
    def test_passes_every_ldap_and_sso_setting_to_the_api(self):
        source = "\n".join(p.read_text(encoding="utf-8") for p in (ROOT / "backend" / "src").rglob("*.ts"))
        read = set(re.findall(r"""get(?:OrThrow)?(?:<\w+>)?\(\s*'((?:LDAP|OIDC)_[A-Z_]+)'""", source))
        self.assertGreater(len(read), 15)
        self.assertEqual(sorted(read - api_environment()), [])
        self.assertIn("VISION_SWAGGER", api_environment())

    def test_the_interface_sends_the_same_headers(self):
        nginx = (ROOT / "frontend" / "nginx" / "default.conf").read_text(encoding="utf-8")
        api = (ROOT / "backend" / "src" / "security.ts").read_text(encoding="utf-8")
        headers = dict(re.findall(r"'([A-Za-z-]+)': '([^']+)'", api.split("SECURITY_HEADERS")[1].split("};")[0]))
        self.assertIn("X-Frame-Options", headers)
        for name, value in headers.items():
            self.assertRegex(nginx, rf'add_header {re.escape(name)} "{re.escape(value)}" always;')
        self.assertIn("server_tokens off;", nginx)


if __name__ == "__main__":
    unittest.main()
