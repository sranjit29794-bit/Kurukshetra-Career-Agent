# Human Action Items (DevProof)

These steps require external human action, credentials, or remote network operations. The system is built and tested around them with automated fallbacks.

---

## 1. LLM API Key (Optional)
- **Status**: Optional. DevProof is 100% functional without an LLM (`LLM_ENABLED=false`).
- **If you have a key**: Add to `backend/.env`:
  ```bash
  LLM_ENABLED=true
  LLM_BASE_URL=https://api.openai.com/v1   # Or your OpenAI-compatible base URL
  LLM_API_KEY=your_actual_api_key_here
  LLM_MODEL=gpt-4o-mini
  ```
- **Validation**: Run `python backend/scripts/smoke_llm.py`. It will print `OK`, `FAIL`, or `DISABLED`.

---

## 2. Webhook Tunnel for Live Push Demo (Optional)
- **Status**: Optional. If no tunnel is provided, the sentinel operates automatically in **transparent polling mode** every 10 seconds.
- **To test live GitHub Webhook delivery**:
  1. Start Cloudflare Tunnel:
     ```bash
     cloudflared tunnel --url http://localhost:8000
     ```
  2. Copy the resulting public HTTPS URL (e.g., `https://xxxx.trycloudflare.com`).
  3. Set `PUBLIC_BASE_URL=https://xxxx.trycloudflare.com` in `backend/.env`.
  4. In your GitHub repository (`Settings -> Webhooks -> Add webhook`):
     - Payload URL: `https://xxxx.trycloudflare.com/api/webhooks/github`
     - Content type: `application/json`
     - Secret: `devproof_demo_secret_2026` (or match `GITHUB_WEBHOOK_SECRET` in `.env`)
     - Events: *Pushes*, *Check runs*, *Workflow runs*.

---

## 3. Remote Repository Pushes (During Final Live Demo)
- **Safety Rule**: The assistant will **never** execute `git push` to any remote.
- **Commands to run by hand during live demo**:
  - **Push Commit C1** (README claims update):
    ```bash
    git push origin C1:refs/heads/main
    ```
  - **Push Commit C2** (SQL database + test suite implementation):
    ```bash
    git push origin C2:refs/heads/main
    ```
  - **Reset Demo Repo back to C0**:
    ```bash
    git push -f origin C0:refs/heads/main
    ```
- *Note*: During automated development and test gates, DevProof uses signed local webhooks and in-memory fixture commits without requiring remote network pushes.

---

## 4. Job Posting Ingestion Verification
- **Paste Path**: Confirm `docs/demo/job_paste.txt` contains the DoorDash Software Engineer posting.
- **Greenhouse Board API Check**:
  ```bash
  curl https://job-boards.greenhouse.io/doordashusa/jobs/8171041
  ```
  Confirmed: Ingestion endpoint fetches public Greenhouse postings and strips HTML formatting automatically.

---

## 5. LinkedIn URL Login Wall Behavior
- **URL**: `https://www.linkedin.com/jobs/view/4478865041/`
- **Expected Behavior**: LinkedIn returns a login wall (`403` or redirect to login page). DevProof detects this wall cleanly and presents a user-friendly instruction card: *"LinkedIn requires login authentication. Please paste the job text directly."*
