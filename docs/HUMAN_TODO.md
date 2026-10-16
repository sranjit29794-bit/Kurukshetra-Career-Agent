# Human Action Items (DevProof)

These are external steps that require human execution or external credentials. The agent will build and verify all surrounding code deterministically in parallel.

## 1. LLM API Key (Optional)
- If you have an OpenAI or Gemini API key, add it to `backend/.env` (`LLM_API_KEY=...`).
- If left blank or `LLM_ENABLED=false`, the system runs in deterministic-only mode (identical status verdicts guaranteed).

## 2. GitHub Push During Phase H / Demo Loop
- When testing real live GitHub push detection:
  - Commit C1: `git push origin C1:refs/heads/main`
  - Commit C2: `git push origin C2:refs/heads/main`
  - Reset to C0: `git push -f origin C0:refs/heads/main`
- The agent will never push to GitHub.

## 3. Webhook Tunnel (For Webhook Demo Moment)
- To demonstrate real GitHub inbound webhooks:
  1. Run `cloudflared tunnel --url http://localhost:8000`
  2. Copy the public https URL into `backend/.env` under `PUBLIC_BASE_URL`
  3. Register webhook on GitHub repository with payload URL `${PUBLIC_BASE_URL}/api/webhooks/github` and secret from `GITHUB_WEBHOOK_SECRET`.
  4. Note: Polling functions automatically without a tunnel.
