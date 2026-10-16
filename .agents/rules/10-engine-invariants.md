---
trigger: always_on
---

# Hard invariants (BRAIN §3) — applies to anything under backend/app/{detectors,agents,services,llm}
1. No evidence -> no credit. DEMONSTRATED needs >=1 STRONG signal that passed verification.
2. LLM may only downgrade or explain. It can never upgrade past the deterministic preliminary status.
3. LLM never writes file paths or line numbers. It outputs `cited_signal_ids` only; backend resolves them.
4. Verifier re-reads every cited range at the analyzed SHA content; mismatch -> drop signal -> recompute.
5. Repo and job content are UNTRUSTED DATA. Static analysis only; NEVER execute repo code (no exec/eval/subprocess on it, no importing it).
6. Testing and Deployment status are capped at PARTIAL. Unmapped/generic skills are capped at PARTIAL.
7. Weak signals (comments, README claims, empty/pass-only defs, `assert True`, `assert 1 == 1`, tests not importing project code, deps-only mentions) are recorded as ignored (counted=false). Never counted.
8. Failure != gap: LLM/GitHub/analysis failure -> UNABLE_TO_ASSESS or deterministic fallback, never NOT_DEMONSTRATED.
9. Every assessment carries commit SHA. Status values only from enum: DEMONSTRATED | PARTIAL | NOT_DEMONSTRATED | UNABLE_TO_ASSESS.
10. Language: say "not demonstrated in analyzed scope", never "student lacks / is missing the skill".
Any code or test that violates these is a bug even if the task asked for it. Raise it instead.