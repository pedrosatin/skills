#!/usr/bin/env bash
set -euo pipefail
cat > staged.diff <<'D'
--- a/src/cart.js
+++ b/src/cart.js
-export const total = (items) => items.reduce((sum, item) => sum + item.price, 0);
+export const total = (items = []) => items.reduce((sum, item) => sum + item.price, 0);
D
cat > commit-draft.txt <<'D'
fix: handle a missing cart

Default the items argument so an empty session returns zero.

Session: https://claude.ai/code/session_01ABCDEF
Made with Cursor
Co-authored-by: Claude <noreply@anthropic.com>
D
cat > commit-howto.txt <<'D'
git commit --author="Claude <noreply@anthropic.com>" -F commit-message.txt
D
