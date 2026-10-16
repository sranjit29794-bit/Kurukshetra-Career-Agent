# DevProof Design System Master File (V2)

**Product:** DevProof — Evidence-backed AI Career Coach  
**Architecture Direction:** Evidence Intelligence Platform  
**Design Workflow:** UI/UX Pro Max Skill Integration  
**Updated:** Phase 4 + Approved Early Product Redesign  

---

## 1. Product Design Direction

DevProof is a high-trust developer intelligence console. It proves student developer capabilities by inspecting real Git commits, verifying line citations with AST detectors and a Skeptic Verifier, and tracking changes automatically through webhooks and polling.

To avoid dreary, pitch-black interfaces while maintaining technical credibility:
- **Dual Mode:** 
  - **Cyber Intelligence (Dark):** Deep navy `#080c14`, elevated surfaces `#0f172a`, vibrant cyan `#06b6d4`, verified emerald `#10b981`, warning amber `#f59e0b`, failure rose `#f43f5e`.
  - **Luminous Engineer (Light):** Crisp snow `#f8fafc`, pure white card surfaces `#ffffff`, subtle slate borders `#cbd5e1`, deep slate text `#0f172a`, ocean cyan `#0284c7`, rich emerald `#059669`.
- **Aesthetic Principles:**
  - Glassmorphic backdrops (`backdrop-blur-md`) with high contrast text.
  - Interactive 3D Perspective Pipeline cards illustrating the verified evidence flow.
  - No emojis as primary structural icons — clean SVG vector icons throughout.
  - Purposeful micro-animations: 180ms hover lifts, 300ms route transitions, pulsing live watcher beacons.
  - Honest status and rate-limit recovery guidance: never display fake progress, stale sample data on error, or hidden secrets.

---

## 2. Typography

- **Heading Font:** `JetBrains Mono, monospace` (Technical, precise, code-aligned)
- **Body Font:** `IBM Plex Sans, Inter, system-ui, sans-serif` (High legibility, balanced geometry)
- **Code & Citations:** `JetBrains Mono` for file paths, line ranges, Git SHAs, and AST code blocks.

Google Fonts import:
```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@400;500;600;700;800&display=swap');
```

---

## 3. Color Tokens & Semantic Status Colors

| Role | Cyber Dark | Luminous Light | CSS Variable |
|------|------------|----------------|--------------|
| Canvas Background | `#080c14` | `#f8fafc` | `--bg-app` |
| Surface (Cards) | `#0f172a` | `#ffffff` | `--bg-surface` |
| Elevated Surface | `#1e293b` | `#f1f5f9` | `--bg-surface-elevated` |
| Card Border | `#334155` | `#cbd5e1` | `--border-card` |
| Primary Text | `#f8fafc` | `#0f172a` | `--text-main` |
| Muted Text | `#94a3b8` | `#475569` | `--text-muted` |
| Accent Cyan | `#06b6d4` | `#0284c7` | `--accent-cyan` |
| Verified (DEMONSTRATED) | `#10b981` | `#059669` | `--accent-emerald` |
| Partial (PARTIAL) | `#f59e0b` | `#d97706` | `--accent-amber` |
| Not Demonstrated | `#94a3b8` | `#64748b` | `--text-dim` |
| Unable to Assess | `#8b5cf6` | `#7c3aed` | `--accent-violet` |
| Error / Failure | `#f43f5e` | `#e11d48` | `--accent-rose` |

---

## 4. Spacing, Radius & Elevation

- **Spacing Scale:**
  - Micro: `4px`, `8px`
  - Compact: `12px`, `16px`
  - Structural: `24px`, `32px`, `48px`
- **Border Radius:**
  - Badges / Small Buttons: `6px` (`--radius-sm`)
  - Cards & Inputs: `10px` (`--radius-md`)
  - Modals & Hero Containers: `16px` (`--radius-lg`)
- **Shadows:**
  - Lift: `0 4px 12px rgba(0,0,0,0.2)`
  - Active Glow: `0 0 20px var(--accent-cyan-glow)`

---

## 5. Multi-Page Architecture & Navigation

1. **Console / Dashboard (`/` or `/dashboard`)**: Overview of active career tracks, watcher engine state, interactive 3D verification pipeline, live activity feed, and primary "+ New Track" action.
2. **New Track / Job Setup (`/track`)**: 3-step staged workflow preserving all user inputs:
   - Step 1: Ingest Job Source (URL or raw text)
   - Step 2: Review & Edit Requirements (editable tags, priorities, custom additions)
   - Step 3: Link GitHub Repository & Pin Commit SHA
   - Confirm & Persist Track
3. **Track Detail / Career Track (`/tracks/:id`)**: Comprehensive track view, pinned SHA freshness, "Run Assessment" action, "Check for New Commits" action, and evidence explorer.
4. **Assessment / Evidence Explorer**: Requirement status badges, AST detector identifiers, immutable commit citations, expandable source code view.
5. **Change Monitor / Sentinel (`/repo-monitor`)**: Live repository watcher status, polling interval, webhook delivery log, bounded tree scope inspector.
6. **Diff & History (`/diff/:id`)**: Before-and-after commit comparison, changed files list, reassessed vs carried-forward requirements.
7. **Settings / Integrations (`/settings`)**: Honest webhook configuration instructions, server `GITHUB_TOKEN` setup guide, health diagnostics.

---

## 6. Rate-Limit Recovery & Error Design

When GitHub API rate limits occur:
1. Explain concisely that GitHub's unauthenticated allowance (60 req/hr) is exhausted.
2. Display formatted reset time based on `reset_epoch`.
3. Provide retry button with rate-limit cooldown.
4. Provide clear instructions for configuring `GITHUB_TOKEN` in the server `.env` file for 5,000 req/hr.
5. Never request tokens from the user via frontend fields.
6. Preserve all user input in the form.

---

## 7. Motion & Accessibility

- CSS transitions: `180ms cubic-bezier(0.16, 1, 0.3, 1)` for hover and focus states.
- Route transition: `@keyframes fadeIn 0.3s ease-out`.
- Reduced Motion: `@media (prefers-reduced-motion: reduce)` disables non-essential animations.
- Minimum tap target: 44px on interactive controls.
- Contrast ratio: Minimum 4.5:1 for body text against surfaces.
