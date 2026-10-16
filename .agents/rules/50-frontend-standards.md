---
trigger: always_on
---

- React 18 + TS + Vite + Tailwind + shadcn (copy-in) + TanStack Query + react-router + lucide-react. Tokens/colors exactly per BRAIN §16.1.
- Not-demonstrated is slate with dashed outline, NEVER red. Every status = icon + text label (never color alone).
- Always show analyzed SHA + timestamp on result views. Persistent banner: "Not demonstrated means not found in the analyzed scope — it doesn't prove you lack the skill."
- Build against `docs/fixtures/*.json` via `VITE_USE_FIXTURES=1` first; API types from `openapi-typescript`. No hardcoded secrets; HTML-escape all repo/job text; never render raw HTML.
- No readiness percentage anywhere. Plain counts only.
- Every state: loading skeleton, empty (instructive), error (with retry). `npx tsc --noEmit` and `npm run build` must pass before a phase is done.
- Visual source of truth: docs/design/reference.png + docs/design/DESIGN-REFERENCE.md. Where they conflict with BRAIN §16.1 visuals, the design reference wins; where they conflict with BRAIN §3 invariants, the invariants win.