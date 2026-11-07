#!/usr/bin/env bash
set -euo pipefail
cat > pr-draft.md <<'D'
**What:** Default the cart items argument so an empty session returns zero.

**Why:** Checkout crashed on a missing cart.

**Result:** All 12 cart tests pass.

Checkpoint 3 of task t3-4471. Full log: https://claude.ai/code/session_01QWERTY

Made with Cursor
D
