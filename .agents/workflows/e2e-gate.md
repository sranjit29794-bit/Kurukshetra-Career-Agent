---
description: Playwright check of the running UI
---

1. Start frontend (fixture mode or real API, as told). 2. Use the Playwright skill to walk the screens named in the phase, take screenshots, and fail on any console error.
3. Verify: status icons + labels visible, SHA chip + timestamp on results, absence≠failure banner present, no red on Not-demonstrated.
4. Report PASS/FAIL per screen.