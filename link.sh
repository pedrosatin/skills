#!/usr/bin/env bash
# Linka cada skill de skills/ em ~/.agents/skills/<nome>, um symlink por skill.
# Uso: ./link.sh. Idempotente. Pastas reais e links alheios ao repo não são
# alterados; o script avisa e pula.
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
      *) echo "pulado: $target aponta para fora do repo" >&2; continue ;;
    esac
    ln -sfn "${src%/}" "$target"
  elif [ -e "$target" ]; then
    echo "pulado: $target existe e não é symlink" >&2
    continue
  else
    ln -s "${src%/}" "$target"
  fi
  echo "ok: $name"
done

# Poda links quebrados. Em ~/.agents/skills, os que apontam para o repo.
# Nas raízes dos harnesses, os que apontam para ~/.agents/skills (só quando
# o destino é o padrão).
prune() {
  local root="$1"; shift
  local link target pat
  [ -d "$root" ] || return 0
  for link in "$root"/*; do
    [ -L "$link" ] && [ ! -e "$link" ] || continue
    target="$(readlink "$link")"
    for pat in "$@"; do
      case "$target" in
        $pat) rm "$link"; echo "removido (quebrado): $link"; break ;;
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
