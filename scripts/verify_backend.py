"""scripts/verify_backend.py: Automated verification of backend live operation.

Steps:
1. Start uvicorn as a subprocess from repo root.
2. Wait for /docs to respond.
3. Check health (db_path, row_counts, mode="real").
4. Create job (POST /api/jobs).
5. List jobs (GET /api/jobs).
6. Create track (POST /api/tracks).
7. Get track (GET /api/tracks/{id}).
8. Restart the server (stop uvicorn, launch again, wait for /docs).
9. Confirm rows persist across restart.
10. Delete the created track and job.
11. Print PASS/FAIL per check.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
from pathlib import Path

import httpx

REPO_ROOT = Path(__file__).resolve().parent.parent
BASE_URL = "http://127.0.0.1:8000"


def find_python() -> str:
    """Find virtualenv Python or fallback to sys.executable."""
    venv_py = REPO_ROOT / "backend" / ".venv" / "Scripts" / "python.exe"
    if venv_py.exists():
        return str(venv_py)
    return sys.executable


def free_port(port: int = 8000) -> None:
    """Terminate any process holding the port so verify_backend can manage its lifecycle."""
    try:
        subprocess.run(
            [
                "powershell",
                "-Command",
                f"Get-NetTCPConnection -LocalPort {port} -ErrorAction SilentlyContinue | ForEach-Object {{ Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }}",
            ],
            capture_output=True,
            text=True,
            timeout=5.0,
        )
        time.sleep(0.5)
    except Exception:
        pass


def start_uvicorn(py_exe: str) -> subprocess.Popen[str]:
    """Launch uvicorn subprocess from REPO_ROOT."""
    free_port(8000)
    cmd = [py_exe, "-m", "uvicorn", "backend.app.main:app", "--port", "8000"]
    proc = subprocess.Popen(
        cmd,
        cwd=str(REPO_ROOT),
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
    )
    return proc


def wait_for_server(timeout_s: float = 15.0) -> bool:
    """Wait until /docs returns HTTP 200."""
    start = time.time()
    while time.time() - start < timeout_s:
        try:
            r = httpx.get(f"{BASE_URL}/docs", timeout=1.0)
            if r.status_code == 200:
                return True
        except Exception:
            pass
        time.sleep(0.5)
    return False


def main() -> int:
    print("=" * 60)
    print(" DevProof Backend Live Verification Runner (STEP 2)")
    print("=" * 60)

    py_exe = find_python()
    print(f"Using Python: {py_exe}")
    print(f"Working Directory: {REPO_ROOT}\n")

    proc = start_uvicorn(py_exe)
    print("[1/9] Starting uvicorn subprocess...")

    checks_passed = 0
    total_checks = 8

    test_job_id = "job_verify_live_test"
    track_id = ""

    try:
        if not wait_for_server(15.0):
            print("[FAIL] Server failed to start and respond on /docs within 15s")
            return 1
        print("[PASS] Server started and /docs responded 200 OK")
        checks_passed += 1

        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            # 1. Health Check
            print("\n[2/9] Checking /api/health...")
            r_health = client.get("/api/health")
            if r_health.status_code != 200:
                print(f"[FAIL] Health returned status {r_health.status_code}")
                return 1
            h_data = r_health.json()
            if h_data.get("mode") != "real":
                print(f"[FAIL] Expected mode='real', got {h_data.get('mode')}")
                return 1
            if not h_data.get("db_path"):
                print("[FAIL] Missing db_path in health response")
                return 1
            if "jobs" not in h_data.get("row_counts", {}):
                print("[FAIL] Missing row_counts in health response")
                return 1
            print(f"[PASS] Health check: mode={h_data['mode']}, db_path={h_data['db_path']}, row_counts={h_data['row_counts']}")
            checks_passed += 1

            # 2. Create Job
            print("\n[3/9] Creating job (POST /api/jobs)...")
            job_payload = {
                "id": test_job_id,
                "title": "Backend Systems Engineer",
                "company": "Kurukshetra Labs",
                "source_url": "https://example.com/jobs/backend-systems",
                "source_type": "user_provided",
                "source_detail": "Verification test job",
                "raw_text": "Requires strong Python and SQL database experience.",
                "requirements": [
                    {
                        "name": "Python Language",
                        "category": "Language",
                        "priority": "must",
                        "source_sentence": "Requires strong Python.",
                        "taxonomy_key": "python_lang",
                        "search_terms": ["Python"],
                        "position": 1,
                    },
                    {
                        "name": "SQL Database",
                        "category": "Database",
                        "priority": "must",
                        "source_sentence": "SQL database experience.",
                        "taxonomy_key": "sql_database",
                        "search_terms": ["SQL", "sqlite"],
                        "position": 2,
                    },
                ],
                "confirmed": True,
            }
            r_create_job = client.post("/api/jobs", json=job_payload)
            if r_create_job.status_code != 200:
                print(f"[FAIL] Create job returned {r_create_job.status_code}: {r_create_job.text}")
                return 1
            print(f"[PASS] Job created: id={r_create_job.json().get('id')}")
            checks_passed += 1

            # 3. List Jobs
            print("\n[4/9] Listing jobs (GET /api/jobs)...")
            r_list_jobs = client.get("/api/jobs")
            if r_list_jobs.status_code != 200:
                print(f"[FAIL] List jobs returned {r_list_jobs.status_code}")
                return 1
            jobs_list = r_list_jobs.json()
            if not any(j.get("id") == test_job_id for j in jobs_list):
                print(f"[FAIL] Created job {test_job_id} not found in listed jobs")
                return 1
            print(f"[PASS] List jobs: verified {test_job_id} exists ({len(jobs_list)} total jobs)")
            checks_passed += 1

            # 4. Create Track
            print("\n[5/9] Creating track (POST /api/tracks)...")
            track_payload = {
                "job_id": test_job_id,
                "repo_url": "https://github.com/sranjit29794-bit/student-api",
                "branch": "main",
            }
            r_create_track = client.post("/api/tracks", json=track_payload)
            if r_create_track.status_code != 200:
                print(f"[FAIL] Create track returned {r_create_track.status_code}: {r_create_track.text}")
                return 1
            track_id = r_create_track.json().get("id")
            if not track_id:
                print("[FAIL] Missing track ID in create track response")
                return 1
            print(f"[PASS] Track created: id={track_id}")
            checks_passed += 1

            # 5. Get Track
            print(f"\n[6/9] Getting track (GET /api/tracks/{track_id})...")
            r_get_track = client.get(f"/api/tracks/{track_id}")
            if r_get_track.status_code != 200:
                print(f"[FAIL] Get track returned {r_get_track.status_code}")
                return 1
            track_data = r_get_track.json()
            if track_data.get("id") != track_id or track_data.get("job_id") != test_job_id:
                print(f"[FAIL] Track data mismatch: {track_data}")
                return 1
            print(f"[PASS] Track details verified: repo={track_data.get('repo_id')}, branch={track_data.get('branch')}")
            checks_passed += 1

            # 6. Restart Server
            print("\n[7/9] Restarting uvicorn server...")
            proc.terminate()
            try:
                proc.wait(timeout=5.0)
            except Exception:
                proc.kill()
            time.sleep(1.0)

            proc = start_uvicorn(py_exe)
            if not wait_for_server(15.0):
                print("[FAIL] Server failed to restart within 15s")
                return 1
            print("[PASS] Server restarted successfully and listening on port 8000")

            # 7. Confirm Rows Persist
            print("\n[8/9] Confirming database rows persisted across restart...")
            r_recheck_track = client.get(f"/api/tracks/{track_id}")
            if r_recheck_track.status_code != 200:
                print(f"[FAIL] Track not found after server restart: {r_recheck_track.status_code}")
                return 1
            r_recheck_jobs = client.get("/api/jobs")
            if not any(j.get("id") == test_job_id for j in r_recheck_jobs.json()):
                print(f"[FAIL] Job {test_job_id} missing after restart")
                return 1
            print(f"[PASS] Persistence verified: track {track_id} and job {test_job_id} exist in SQLite")
            checks_passed += 1

            # 8. Delete Them
            print(f"\n[9/9] Cleaning up (DELETE /api/tracks/{track_id} and DELETE /api/jobs/{test_job_id})...")
            r_del_track = client.delete(f"/api/tracks/{track_id}")
            if r_del_track.status_code != 200:
                print(f"[FAIL] Delete track returned {r_del_track.status_code}: {r_del_track.text}")
                return 1
            r_del_job = client.delete(f"/api/jobs/{test_job_id}")
            if r_del_job.status_code != 200:
                print(f"[FAIL] Delete job returned {r_del_job.status_code}: {r_del_job.text}")
                return 1

            # Confirm 404 after deletion
            if client.get(f"/api/tracks/{track_id}").status_code != 404:
                print("[FAIL] Track still exists after deletion")
                return 1
            print("[PASS] Successfully deleted track and job; confirmed 404 response")
            checks_passed += 1

    finally:
        if proc:
            proc.terminate()
            try:
                proc.wait(timeout=3.0)
            except Exception:
                proc.kill()

    print("\n" + "=" * 60)
    print(f" VERIFICATION RESULT: {checks_passed}/{total_checks} CHECKS PASSED")
    print("=" * 60)
    return 0 if checks_passed == total_checks else 1


if __name__ == "__main__":
    sys.exit(main())
