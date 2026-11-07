#!/usr/bin/env bash
set -euo pipefail
cat > staged-files.txt <<'D'
.scratch/cart/plan.md
agent-session.log
graphify-out/graph.json
src/cart.js
D
