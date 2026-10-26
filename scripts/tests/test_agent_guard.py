"""Tests for the agent guard hook (.claude/hooks/guard.py).

    python3 -I scripts/tests/test_agent_guard.py
"""
import json
import pathlib
import subprocess
import sys
import unittest

GUARD = pathlib.Path(__file__).resolve().parents[2] / ".claude" / "hooks" / "guard.py"


def run(command, tool="Bash"):
    payload = json.dumps({"tool_name": tool, "tool_input": {"command": command}})
    done = subprocess.run([sys.executable, "-I", str(GUARD)], input=payload, capture_output=True, text=True)
    return done.returncode, done.stderr


class AgentGuardTest(unittest.TestCase):
    def assertBlocked(self, command, why):
        code, err = run(command)
        self.assertEqual(code, 2, f"not blocked: {command}")
        self.assertIn(why, err)

    def assertAllowed(self, command):
        code, err = run(command)
        self.assertEqual(code, 0, f"blocked: {command}: {err}")

    def test_runs_docker_compose_only_through_vision_sh(self):
        self.assertBlocked("docker compose -f docker-compose.yml down", "scripts/vision.sh")
        self.assertBlocked("cd /srv && COMPOSE_PROJECT_NAME=vrt docker-compose up -d", "scripts/vision.sh")
        self.assertAllowed("./scripts/vision.sh up -d --build")
        self.assertAllowed("./scripts/vision.sh logs migration")

    def test_keeps_hands_off_containers_and_volumes_that_are_not_visions(self):
        self.assertBlocked("docker rm -f vrt_api_1", "Vision's containers")
        self.assertBlocked("docker stop vision-dev-pg vrt_db_1", "vrt_db_1")
        self.assertBlocked("docker volume prune -f", "production")
        self.assertBlocked("docker system prune -a", "production")
        self.assertAllowed("docker stop vision-dev-pg")
        self.assertAllowed("docker run -d --name vision-dev-pg -p 15433:5432 postgres:16")
        self.assertAllowed("docker ps -a")

    def test_pushes_only_to_the_vision_remote(self):
        self.assertBlocked("git push", "vision")
        self.assertBlocked("git push origin mvp/demo", "vision")
        self.assertBlocked("git add -A && git commit -m x && git push -u origin HEAD", "vision")
        self.assertAllowed("git -c http.postBuffer=1048576000 push vision mvp/demo:main")
        self.assertAllowed("git status && git log --oneline -3")

    def test_refuses_resets_and_drops(self):
        self.assertBlocked("cd backend && npx prisma migrate reset --force", "additive")
        self.assertBlocked("npx prisma db push --accept-data-loss", "additive")
        self.assertBlocked("psql -c 'drop database vrt'", "DROP DATABASE")
        self.assertBlocked("dropdb vrt", "deletes data")
        self.assertAllowed("npx prisma migrate deploy")
        self.assertAllowed("npx prisma generate")

    def test_lets_other_tools_and_odd_input_through(self):
        self.assertEqual(run("git push origin", tool="Read")[0], 0)
        done = subprocess.run([sys.executable, "-I", str(GUARD)], input="not json", capture_output=True, text=True)
        self.assertEqual(done.returncode, 0)


if __name__ == "__main__":
    unittest.main(verbosity=2)
