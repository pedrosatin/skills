#!/usr/bin/env bash
# Link each skill in skills/ to ~/.agents/skills/<name>, one symlink per skill.
# Usage: ./link.sh. Idempotent. Warn and skip existing directories and links
# pointing outside the repo.
set -euo pipefail
shopt -s nullglob
repo="$(cd "$(dirname "$0")" && pwd)/skills"
default="$HOME/.agents/skills"
dest="${AGENTS_SKILLS_DIR:-$default}"
mkdir -p "$dest"
for src in "$repo"/*/; do
  name="$(basename "$src")"
  target="$dest/$name"
  if [ -L "$target" ]; then
    case "$(readlink "$target")" in
      "$repo"/*) ;;
      *) echo "skipped: $target points outside the repo" >&2; continue ;;
    esac
    ln -sfn "${src%/}" "$target"
  elif [ -e "$target" ]; then
    echo "skipped: $target exists and is not a symlink" >&2
    continue
  else
    ln -s "${src%/}" "$target"
  fi
  echo "ok: $name"
done

# Prune broken links pointing to the repo in ~/.agents/skills. In agent skill
# roots, prune links pointing to ~/.agents/skills only when using the default
# destination.
prune() {
  local root="$1"; shift
  local link target pat
  [ -d "$root" ] || return 0
  for link in "$root"/*; do
    [ -L "$link" ] && [ ! -e "$link" ] || continue
    target="$(readlink "$link")"
    for pat in "$@"; do
      case "$target" in
        $pat) rm "$link"; echo "removed (broken): $link"; break ;;
      esac
    done
  done
}
prune "$dest" "$repo/*"
if [ "$dest" = "$default" ]; then
  for root in "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.gemini/skills"; do
    prune "$root" "$default/*" "../../.agents/skills/*"
  done
fi
