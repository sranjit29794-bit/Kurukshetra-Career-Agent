# Design reference (overrides BRAIN §16.1 visuals; invariants in BRAIN §3 still win)
Source of truth for look: docs/design/reference.png. Sample colors from the image where tokens below are approximate.
Tokens (approx.): bg #050A1A · surface #0A1228 · surface-2 #101A30 · border #1A2748 · primary #2F6DF6 (buttons, active nav pill, links) · text #E8EEF9 · muted #8C9AB8
Status: Demonstrated emerald on emerald-tint pill ✓ · Partial amber on amber-tint pill ◐ · Not demonstrated SLATE #94A3B8, dashed outline ○ (never red) · Unable to assess violet ⚠
Shape: cards radius 14–16px, 1px border, soft inner glow; pills radius 8px; skill icons = lucide icon in a colored rounded-square tile; generous padding; Inter + JetBrains Mono.
Layout: left sidebar (logo+tagline, Home/Assessments/Jobs/GitHub/Agent Activity/Settings, "Live & Change-Aware" note at bottom) + top-right static profile chip.
Hard overrides: no red for absence, no readiness %, SHA+timestamp on results, absence≠failure banner visible (subtle), Testing/Deployment ≤ Partial in all fixtures.