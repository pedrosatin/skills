#!/usr/bin/env bash
# validate-agent-config — valida entry points de instruções, CONTEXT.md e skills
# Fonte da verdade do layout: ~/.agents/SKILLS.md e o cabeçalho de ~/.agents/CONTEXT.md
set -u
HOME_DIR="${HOME:?}"
CONTEXT="$HOME_DIR/.agents/CONTEXT.md"
AGENTS_SKILLS="$HOME_DIR/.agents/skills"
CLAUDE_SKILLS="$HOME_DIR/.claude/skills"
errors=0; warnings=0; checks=0

err()  { checks=$((checks+1)); errors=$((errors+1));   echo "ERRO:  $*"; }
warn() { checks=$((checks+1)); warnings=$((warnings+1)); echo "AVISO: $*"; }
ok()   { checks=$((checks+1)); }

# ---------- 1. entry points de instruções ----------
resolve() { readlink -f "$1" 2>/dev/null; }

echo "== 1. Entry points de instruções"
[ -f "$CONTEXT" ] || { echo "ERRO:  falta $CONTEXT"; exit 1; }

for f in "$HOME_DIR/AGENTS.md" \
         "$HOME_DIR/.config/opencode/AGENTS.md" \
         "$HOME_DIR/.codex/AGENTS.md" \
         "$HOME_DIR/.gemini/GEMINI.md" \
         "$HOME_DIR/.grok/AGENTS.md"; do
  if [ -L "$f" ] && [ -e "$f" ]; then
    if [ "$(resolve "$f")" = "$CONTEXT" ]; then ok
    else err "$(basename "$(dirname "$f")")/$(basename "$f") resolvem para $(resolve "$f"), esperado $CONTEXT"; fi
  elif [ -e "$f" ]; then warn "$f existe mas NÃO é symlink (deveria apontar para o CONTEXT.md)"
  else err "$f não existe"; fi
done

for f in "$HOME_DIR/.claude/CLAUDE.md" "$HOME_DIR/.claude-w/CLAUDE.md" "$HOME_DIR/.claude-p/CLAUDE.md"; do
  if [ ! -f "$f" ] || [ -L "$f" ]; then err "$f deveria ser arquivo REAL com @import (está ausente ou é symlink)"; continue; fi
  ok
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    case "$ref" in
      "~/"*) target="$HOME_DIR/${ref:2}" ;;
      "/"*)  target="$ref" ;;
      *)     target="$(dirname "$f")/$ref" ;;
    esac
    if [ -e "$target" ]; then ok; else err "import @$ref em $f não resolve ($target)"; fi
  done < <(grep -E '^@' "$f" | sed 's/^@//' | sed 's/\r$//')
done

CI="$HOME_DIR/.copilot/copilot-instructions.md"
if [ -f "$CI" ]; then
  grep -q "context-global-pointer" "$CI" && ok || warn "$CI sem o bloco context-global-pointer (Copilot perde as regras globais em projetos)"
else err "$CI não existe"; fi

# ---------- 2. higiene do CONTEXT.md ----------
echo "== 2. Paths e binários citados no CONTEXT.md"
while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$HOME_DIR${p#\~}" ] || warn "path citado no CONTEXT.md não existe: $p"
done < <(grep -oE '~(/[a-zA-Z0-9._/-]+)' "$CONTEXT" | sort -u)

while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$HOME_DIR${p#\~}" ] || err "skill citada no CONTEXT.md não existe: $p"
done < <(grep -oE '~/\.?[a-zA-Z0-9._/-]*skills/[a-zA-Z0-9._-]+/SKILL\.md' "$CONTEXT" | sort -u)

while IFS= read -r b; do
  [ -n "$b" ] || continue
  command -v "$b" >/dev/null 2>&1 || warn "binário citado no CONTEXT.md não está no PATH: $b"
done < <(grep -oE '\b[a-z]+(-[a-z]+)*-axi\b|\brtk\b' "$CONTEXT" | sort -u)

# ---------- 3. skills ----------
echo "== 3. Skills"
for root in "$AGENTS_SKILLS" "$CLAUDE_SKILLS"; do
  [ -d "$root" ] || { err "raiz de skills ausente: $root"; continue; }
  for e in "$root"/*; do
    name="$(basename "$e")"
    [ "$name" = "synced" ] && continue
    if [ -L "$e" ]; then
      if [ -e "$e" ]; then ok; else err "symlink quebrado: $e -> $(readlink "$e")"; fi
      continue
    fi
    [ -d "$e" ] || continue
    if [ ! -f "$e/SKILL.md" ]; then err "$name ($root): diretório sem SKILL.md"; continue; fi
    ok
    head -c 2000 "$e/SKILL.md" | grep -q '^description:' || warn "$name: frontmatter sem description (skill não é anunciada ao modelo)"
    head -c 2000 "$e/SKILL.md" | grep -q '^name:' || warn "$name: frontmatter sem name"
  done
done

for e in "$AGENTS_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  c="$CLAUDE_SKILLS/$name"
  if [ -d "$c" ] && [ ! -L "$c" ]; then
    case "$name" in ai-memory-*) ok ;; *) err "$name é diretório REAL nas duas raízes (drift) — uma deve ser symlink" ;; esac
  fi
done

for e in "$CLAUDE_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  case "$name" in ai-memory-*|synced) continue ;; esac
  [ -e "$AGENTS_SKILLS/$name" ] || warn "$name é diretório real só em ~/.claude/skills — considere mover para ~/.agents/skills"
done

echo
echo "Resultado: $checks checks, $errors erro(s), $warnings aviso(s)"
[ "$errors" -eq 0 ] || exit 1
exit 0
