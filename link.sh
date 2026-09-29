#!/usr/bin/env bash
# Linka cada skill de skills/ em ~/.agents/skills/<nome> (symlink por skill).
# Uso: ./link.sh   (idempotente; não sobrescreve pastas reais, só avisa)
set -euo pipefail
repo="$(cd "$(dirname "$0")" && pwd)/skills"
dest="${AGENTS_SKILLS_DIR:-$HOME/.agents/skills}"
mkdir -p "$dest"
for src in "$repo"/*/; do
  name="$(basename "$src")"
  target="$dest/$name"
  if [ -L "$target" ]; then
    ln -sfn "${src%/}" "$target"
  elif [ -e "$target" ]; then
    echo "pulado: $target existe e não é symlink" >&2
  else
    ln -s "${src%/}" "$target"
  fi
  echo "ok: $name"
done

# Poda symlinks quebrados de skills removidas do repo: em ~/.agents/skills
# (aponta para o repo) e nas raízes dos harnesses (apontam para ~/.agents/skills).
for root in "$dest" "$HOME/.claude/skills" "$HOME/.codex/skills" "$HOME/.gemini/skills"; do
  [ -d "$root" ] || continue
  for link in "$root"/*; do
    [ -L "$link" ] && [ ! -e "$link" ] || continue
    case "$(readlink "$link")" in
      "$repo"/*|*/.agents/skills/*) rm "$link"; echo "removido (quebrado): $link" ;;
    esac
  done
done
