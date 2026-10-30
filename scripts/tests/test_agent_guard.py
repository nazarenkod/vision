"""Tests for the agent guard hook (.claude/hooks/guard.py).

    python3 -I scripts/tests/test_agent_guard.py
"""
import json
import pathlib
import subprocess
import sys
import tempfile
import unittest

GUARD = pathlib.Path(__file__).resolve().parents[2] / ".claude" / "hooks" / "guard.py"


def clone_with_origin(url=None):
    """A folder for the hook to run in: no repository, or one whose origin is url."""
    folder = tempfile.mkdtemp()
    if url:
        subprocess.run(["git", "init", "-q", folder], check=True)
        subprocess.run(["git", "-C", folder, "remote", "add", "origin", url], check=True)
    return folder


NO_REPOSITORY = clone_with_origin()


def run(command, tool="Bash", cwd=NO_REPOSITORY):
    payload = json.dumps({"tool_name": tool, "tool_input": {"command": command}, "cwd": cwd})
    done = subprocess.run([sys.executable, "-I", str(GUARD)], input=payload, capture_output=True, text=True)
    return done.returncode, done.stderr


class AgentGuardTest(unittest.TestCase):
    def assertBlocked(self, command, why, cwd=NO_REPOSITORY):
        code, err = run(command, cwd=cwd)
        self.assertEqual(code, 2, f"not blocked: {command}")
        self.assertIn(why, err)

    def assertAllowed(self, command, cwd=NO_REPOSITORY):
        code, err = run(command, cwd=cwd)
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

    def test_pushes_a_feature_branch_to_origin_only_where_origin_is_visions_repository(self):
        vision = clone_with_origin("https://github.com/nazarenkod/vision")
        upstream = clone_with_origin("https://github.com/Visual-Regression-Tracker/Visual-Regression-Tracker.git")
        self.assertAllowed("git push -u origin spec/028-allowed-devices", cwd=vision)
        self.assertAllowed("git push origin spec/028-allowed-devices", cwd=clone_with_origin("git@github.com:nazarenkod/vision.git"))
        self.assertBlocked("git push -u origin spec/028-allowed-devices", "vision", cwd=upstream)
        self.assertBlocked("git push origin main", "vision", cwd=vision)
        self.assertBlocked("git push origin HEAD", "vision", cwd=vision)
        self.assertBlocked("git push origin HEAD:main", "vision", cwd=vision)
        self.assertBlocked("git push origin +spec/x", "vision", cwd=vision)
        self.assertBlocked("git push --force origin spec/x", "vision", cwd=vision)
        self.assertBlocked("git push --force-with-lease origin spec/x", "vision", cwd=vision)
        self.assertBlocked("git push origin --delete spec/x", "vision", cwd=vision)
        self.assertBlocked(f"git -C {upstream} push origin spec/x", "vision", cwd=vision)
        self.assertBlocked("git push origin spec/x other/y", "vision", cwd=vision)

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
