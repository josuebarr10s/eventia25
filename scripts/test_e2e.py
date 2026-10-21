"""Run browser tests against a disposable PostgreSQL database and owned servers."""

import os
import secrets
import subprocess
import sys
import time
import urllib.request
from pathlib import Path

import psycopg
from psycopg import sql
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")
database = "eventia_e2e_" + secrets.token_hex(6)
env = os.environ.copy()
env.update(
    {
        "POSTGRES_DB": database,
        "DJANGO_DEBUG": "true",
        "CSRF_TRUSTED_ORIGINS": "http://127.0.0.1:5174",
        "EVENTIA_API_TARGET": "http://127.0.0.1:8001",
        "E2E_ORGANIZER_EMAIL": "organizer@e2e.example.test",
        "E2E_PASSWORD": secrets.token_urlsafe(24),
        "EMAIL_BACKEND": "django.core.mail.backends.console.EmailBackend",
    }
)
env["EVENTIA_ORGANIZER_PASSWORD"] = env["E2E_PASSWORD"]
connection_options = {
    "dbname": "postgres",
    "user": env.get("POSTGRES_USER", "eventia"),
    "password": env.get("POSTGRES_PASSWORD", ""),
    "host": env.get("POSTGRES_HOST", "127.0.0.1"),
    "port": env.get("POSTGRES_PORT", "5432"),
}
processes = []
log_dir = ROOT / ".runtime" / "e2e"
log_dir.mkdir(parents=True, exist_ok=True)


def manage(*args):
    subprocess.run(
        [sys.executable, str(ROOT / "backend/manage.py"), *args],
        cwd=ROOT,
        env=env,
        check=True,
    )


def wait_for(url):
    for _ in range(60):
        if any(p.poll() is not None for p in processes):
            raise RuntimeError(
                "Un servidor terminó antes de estar disponible. Revisa .runtime/e2e/."
            )
        try:
            with urllib.request.urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (OSError, urllib.error.URLError):
            time.sleep(0.5)
    raise RuntimeError(f"El servidor no estuvo disponible: {url}")


result = 1
with psycopg.connect(**connection_options, autocommit=True) as conn:
    conn.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
try:
    manage("migrate", "--noinput", "--verbosity", "0")
    manage(
        "create_organizer",
        "--email",
        env["E2E_ORGANIZER_EMAIL"],
        "--name",
        "Organización de prueba",
    )
    manage("seed_demo", "--organizer", env["E2E_ORGANIZER_EMAIL"])
    with (
        (log_dir / "backend.log").open("w") as backend_log,
        (log_dir / "frontend.log").open("w") as frontend_log,
    ):
        processes.append(
            subprocess.Popen(
                [
                    sys.executable,
                    "backend/manage.py",
                    "runserver",
                    "127.0.0.1:8001",
                    "--noreload",
                ],
                cwd=ROOT,
                env=env,
                stdout=backend_log,
                stderr=subprocess.STDOUT,
            )
        )
        processes.append(
            subprocess.Popen(
                [
                    "node",
                    "node_modules/vite/bin/vite.js",
                    "--host",
                    "127.0.0.1",
                    "--port",
                    "5174",
                ],
                cwd=ROOT / "frontend",
                env=env,
                stdout=frontend_log,
                stderr=subprocess.STDOUT,
            )
        )
        wait_for("http://127.0.0.1:8001/api/events/")
        wait_for("http://127.0.0.1:5174/")
        results = []
        for index, project in enumerate(["desktop", "tablet", "mobile"]):
            if index:
                # Each viewport has a fresh server cache so automated traffic
                # does not consume another viewport's real rate limit quota.
                backend = processes.pop(0)
                backend.terminate()
                backend.wait(timeout=10)
                processes.insert(
                    0,
                    subprocess.Popen(
                        [
                            sys.executable,
                            "backend/manage.py",
                            "runserver",
                            "127.0.0.1:8001",
                            "--noreload",
                        ],
                        cwd=ROOT,
                        env=env,
                        stdout=backend_log,
                        stderr=subprocess.STDOUT,
                    ),
                )
                wait_for("http://127.0.0.1:8001/api/events/")
            results.append(
                subprocess.run(
                    ["npm", "run", "test:e2e", "--", "--project", project],
                    cwd=ROOT / "frontend",
                    env={**env, "E2E_PROJECT": project},
                ).returncode
            )
        result = 1 if any(results) else 0
finally:
    for process in reversed(processes):
        process.terminate()
    for process in processes:
        try:
            process.wait(timeout=10)
        except subprocess.TimeoutExpired:
            process.kill()
            process.wait()
    with psycopg.connect(**connection_options, autocommit=True) as conn:
        conn.execute(
            sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database))
        )
sys.exit(result)
