"""Deployment settings for sign-in and the security headers (spec 045).

    python3 -I scripts/tests/test_api_hardening.py

The API in docker-compose.demo.yml gets every LDAP and SSO setting the API reads, and the
interface's nginx sends the same security headers as the API.
"""
import os
import pathlib
import re
import shutil
import subprocess
import tempfile
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

    # 052: the policy is written at the container's start with the API's address, from one template
    def start_interface(self, api_url):
        with tempfile.TemporaryDirectory() as folder:
            work = pathlib.Path(folder)
            shutil.copy(ROOT / "frontend" / "env.sh", work / "env.sh")
            shutil.copy(ROOT / "frontend" / "env.defaults", work / "env.defaults")
            shutil.copy(ROOT / "frontend" / "nginx" / "csp.template", work / "csp.template")
            env = {"PATH": os.environ.get("PATH", ""), "REACT_APP_API_URL": api_url,
                   "VISION_CSP_FILE": str(work / "csp.conf")}
            subprocess.run(["sh", "./env.sh"], cwd=work, env=env, check=True)
            return (work / "csp.conf").read_text(encoding="utf-8"), (work / "env-config.js").read_text(encoding="utf-8")

    def test_ui_has_the_content_security_policy(self):
        nginx = (ROOT / "frontend" / "nginx" / "default.conf").read_text(encoding="utf-8")
        self.assertIn("include /tmp/vision-csp.conf;", nginx)
        header, config = self.start_interface("https://vision-api.bank.example:14200/base")
        self.assertTrue(header.startswith('add_header Content-Security-Policy "default-src \'self\'; script-src \'self\';'))
        self.assertTrue(header.rstrip().endswith('" always;'))
        self.assertIn("connect-src 'self' https://vision-api.bank.example:14200 wss://vision-api.bank.example:14200;", header)
        self.assertIn("img-src 'self' data: blob: https://vision-api.bank.example:14200;", header)
        self.assertIn("frame-ancestors 'none'", header)
        self.assertNotIn("${", header)
        # the interface's own settings are written as before
        self.assertIn('REACT_APP_API_URL: "https://vision-api.bank.example:14200/base"', config)
        # the default API address, as in env.defaults
        header, _ = self.start_interface("")
        self.assertIn("connect-src 'self' http://localhost:4200 ws://localhost:4200;", header)
        # no inline script left for the policy to block
        index = (ROOT / "frontend" / "index.html").read_text(encoding="utf-8")
        self.assertNotRegex(index, r"<script>(?!\s*</script>)")
        # the image ships the template env.sh fills
        self.assertIn("COPY nginx/csp.template ./csp.template", (ROOT / "frontend" / "Dockerfile").read_text(encoding="utf-8"))

    def test_ui_policy_takes_an_api_on_its_own_host_and_refuses_to_start_without_a_policy(self):
        header, _ = self.start_interface("/api")
        self.assertNotIn("/api", header)
        self.assertIn("connect-src 'self'", header)
        with tempfile.TemporaryDirectory() as folder:
            work = pathlib.Path(folder)
            shutil.copy(ROOT / "frontend" / "env.sh", work / "env.sh")
            shutil.copy(ROOT / "frontend" / "env.defaults", work / "env.defaults")
            (work / "csp.template").write_text("", encoding="utf-8")
            env = {"PATH": os.environ.get("PATH", ""), "VISION_CSP_FILE": str(work / "csp.conf")}
            result = subprocess.run(["sh", "./env.sh"], cwd=work, env=env, capture_output=True, text=True)
            self.assertNotEqual(result.returncode, 0)
            self.assertIn("no content security policy", result.stderr)

    def test_ui_sends_hsts_only_over_https(self):
        nginx = (ROOT / "frontend" / "nginx" / "default.conf").read_text(encoding="utf-8")
        hsts_map = re.search(r"map \$http_x_forwarded_proto \$vision_hsts \{(.*?)\}", nginx, re.S).group(1)
        self.assertRegex(hsts_map, r'default "";')
        self.assertRegex(hsts_map, r'~\^https "max-age=31536000";')
        self.assertIn("add_header Strict-Transport-Security $vision_hsts always;", nginx)


if __name__ == "__main__":
    unittest.main()
