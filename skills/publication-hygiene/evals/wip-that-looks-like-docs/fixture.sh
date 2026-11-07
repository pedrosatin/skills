#!/usr/bin/env bash
set -euo pipefail
cat > staged-files.txt <<'D'
.claude/settings.local.json
coverage/lcov.info
docs/plans/cart-rollout.md
docs/spikes/cart-rounding.md
reports/cart-benchmark.md
src/cart.js
test/cart.test.js
D
