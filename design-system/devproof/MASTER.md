# DevProof Design System Master File (Student-First Edition)

**Product:** DevProof — Student-First Career Intelligence Platform  
**Target Audience:** Students & Early-Career Developers Applying for Internships & Jobs  
**Phase Target:** Phase 5 Unified MVP & Demo Reliability Gate  
**Design Workflow:** UI/UX Pro Max Skill (`ui-ux-pro-max`)  

---

## 1. Product Design Direction

DevProof is designed specifically for college students and junior developers. Rather than feeling like a gloomy security terminal, hacker dashboard, or generic AI template, it presents an editorial, high-trust, welcoming career intelligence platform.

### Core Visual Principles
- **Student-First Warmth:** Default clean luminous palette with warm off-white canvas (`#f8fafc`), clean pure-white surfaces (`#ffffff`), and deep ink/navy typography (`#0f172a`).
- **Trust Indigo & Fresh Mint:** Confident Indigo primary action color (`#4f46e5`), fresh Mint/Emerald for verified code proof (`#059669`), warm amber for partial/learning gaps (`#d97706`), and clear rose only for genuine errors (`#e11d48`).
- **Interactive 3D Pipeline & Purposeful Motion:** Interactive perspective stages explaining the AST parsing and skeptic verification pipeline without overwhelming the user or slowing the interface.
- **Night-Study Mode Support:** Dedicated dark mode toggle for late-night student study sessions (`#0b1120`).

---

## 2. Typography

- **Heading & UI Sans:** `Plus Jakarta Sans` / `Inter` (Friendly, modern, geometric clarity)
- **Technical & Code:** `JetBrains Mono` for commit SHAs, file paths, line ranges, and verified code snippets.

Google Fonts import:
```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700&display=swap');
```

---

## 3. Color Tokens & Semantic Status Colors

| Role | Light (Default) | Dark (Night Study) | CSS Variable |
|---|---|---|---|
| Page Canvas | `#f8fafc` (Warm Slate) | `#0b1120` | `--bg-app` |
| Primary Surface | `#ffffff` | `#111827` | `--bg-surface` |
| Elevated Surface | `#f1f5f9` | `#1f2937` | `--bg-surface-elevated` |
| Primary Action | `#4f46e5` (Trust Indigo) | `#6366f1` | `--accent-primary` |
| Verified (DEMONSTRATED) | `#059669` (Fresh Mint) | `#10b981` | `--accent-verified` |
| Verified Pill Background | `#ecfdf5` | `rgba(16,185,129,0.1)` | `--accent-verified-bg` |
| Partial Result | `#d97706` (Warm Amber) | `#f59e0b` | `--accent-partial` |
| Partial Pill Background | `#fffbeb` | `rgba(245,158,11,0.1)` | `--accent-partial-bg` |
| Not Demonstrated / Gap | `#64748b` (Slate Neutral) | `#6b7280` | `--text-dim` |
| Error / Failure | `#e11d48` (Rose) | `#f43f5e` | `--accent-rose` |

---

## 4. Multi-Page Student Experience

1. **Student Console (`/` or `/dashboard`)**: Personal launchpad showing active career tracks, repo freshness, interactive verification pipeline diagram, and quick onboarding.
2. **Career Track Setup (`/track`)**: Low-friction 3-step staged workflow with demo job presets, editable extracted requirements, repository connector with live pinned SHA, and dedicated rate-limit recovery.
3. **Career Track Detail (`/tracks/:id`)**: Role requirements, repository metadata, "Run Assessment" action, manual commit checker, scorecards, and tabbed evidence explorer.
4. **Skill Evidence Explorer**: Line-by-line Skeptic-verified code citations with syntax highlighting and explicit caveats that missing evidence in repo is never proof of missing student skill.
5. **Before & After Reassessment Diff (`/diff/:id`)**: Clear commit delta comparison (`from_sha` ➔ `to_sha`), changed files list, and skill progression deltas (`IMPROVED`, `UNCHANGED`).
6. **Repository Sentinel (`/repo-monitor`)**: Live repository watcher inspection, bounded file scope tree, and push activity logs.
7. **Settings & Integrations (`/settings`)**: Webhook setup instructions (HMAC SHA-256), polling status, and server-side token setup guidance.

---

## 5. Rate-Limit Handling & Trust Guarantees

- When GitHub unauthenticated limits (60 req/hr) are reached, the UI presents an informative recovery card with the exact formatted reset time.
- All entered form state (job description text, extracted requirements, repo URL) is retained across failures.
- Server-side GitHub token configuration is clearly explained; users are never asked to enter raw tokens in frontend forms.
- Stale fixture data is never displayed as live when a request fails.
