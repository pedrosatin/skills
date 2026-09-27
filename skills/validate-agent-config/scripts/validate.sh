#!/usr/bin/env bash
# validate-agent-config: valida entry points de instruções, CONTEXT.md, skills e sync com o repo
# Fonte da verdade do layout: ~/.agents/SKILLS.md e o cabeçalho de ~/.agents/CONTEXT.md
# Convenções de invocação (user-invoked vs model-invoked): convenção mattpocock/skills .agents/invocation.md
set -u
HOME_DIR="${HOME:?}"
CONTEXT="$HOME_DIR/.agents/CONTEXT.md"
AGENTS_SKILLS="$HOME_DIR/.agents/skills"
CLAUDE_SKILLS="$HOME_DIR/.claude/skills"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_FROM_SCRIPT="$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd)"
if [ -d "$REPO_FROM_SCRIPT/skills" ] && [ -f "$REPO_FROM_SCRIPT/ATTRIBUTION.md" ]; then
  REPO="${SKILLS_REPO:-$REPO_FROM_SCRIPT}"
else
  REPO="${SKILLS_REPO:-$HOME_DIR/Work/personal/skills}"
fi

errors=0; warnings=0; checks=0

err()  { checks=$((checks+1)); errors=$((errors+1));   echo "ERRO:  $*"; }
warn() { checks=$((checks+1)); warnings=$((warnings+1)); echo "AVISO: $*"; }
ok()   { checks=$((checks+1)); }

resolve() { readlink -f "$1" 2>/dev/null; }
skill_exists() { [ -e "$AGENTS_SKILLS/$1" ] || [ -e "$CLAUDE_SKILLS/$1" ]; }

# ---------- 1. entry points de instruções ----------
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

# ---------- 3. skills: estrutura ----------
echo "== 3. Skills (estrutura)"
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
  done
done

for e in "$AGENTS_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  c="$CLAUDE_SKILLS/$name"
  if [ -d "$c" ] && [ ! -L "$c" ]; then
    case "$name" in ai-memory-*) ok ;; *) err "$name é diretório REAL nas duas raízes (drift): uma deve ser symlink" ;; esac
  fi
done

for e in "$CLAUDE_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  case "$name" in ai-memory-*|synced) continue ;; esac
  [ -e "$AGENTS_SKILLS/$name" ] || warn "$name é diretório real só em ~/.claude/skills: considere mover para ~/.agents/skills"
done

# ---------- 4. skills: lint de SKILL.md (convenções) ----------
echo "== 4. Skills (lint de conteúdo)"
for root in "$AGENTS_SKILLS" "$CLAUDE_SKILLS"; do
  for e in "$root"/*; do
    [ -f "$e/SKILL.md" ] || continue
    [ -L "$e" ] && resolve "$e" >/dev/null || true
    name="$(basename "$e")"
    real="$e"; [ -L "$e" ] && real="$(resolve "$e")"
    sk="$real/SKILL.md"

    # 4.1 ID: kebab-case, <=64 (padrão portável; OpenCode recomenda)
    if ! printf '%s' "$name" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
      warn "ID fora do kebab-case: $name"
    else ok; fi
    [ "${#name}" -le 64 ] || warn "ID com mais de 64 chars: $name"

    # 4.2 campos do frontmatter e paridade de name com o diretório
    head -c 2000 "$sk" | grep -q '^description:' || warn "$name: frontmatter sem description (skill não é anunciada ao modelo)"
    head -c 2000 "$sk" | grep -q '^name:' || warn "$name: frontmatter sem name"
    fm_name="$(awk '/^name:/{sub(/^name:[[:space:]]*/,""); gsub(/^["'"'"']|["'"'"']$/,""); print; exit}' "$sk")"
    if [ "$fm_name" = "$name" ]; then
      ok
    else
      err "$name: campo name diverge do diretório (name: '$fm_name')"
    fi

    # extrai bloco completo de description (inclui blocos multilinha com | ou >)
    desc="$(awk '
      BEGIN { in_fm=0; in_desc=0 }
      /^---$/ { if (!in_fm) { in_fm=1; next } else exit }
      in_fm && /^description:[[:space:]]*/ {
        in_desc=1
        sub(/^description:[[:space:]]*[|>-[0-9]*]?[[:space:]]*/, "")
        if (length($0) > 0) print
        next
      }
      in_fm && in_desc {
        if (/^[a-zA-Z0-9_-]+:[[:space:]]*/ || /^---$/) exit
        print
      }
    ' "$sk")"
    [ "${#desc}" -le 1024 ] || warn "$name: description com ${#desc} chars (imposto de contexto em toda sessão)"

    # 4.3 paridade de invocação e verificação de gatilhos
    dmi="$(grep -c '^disable-model-invocation: *true' "$sk")"
    if [ -f "$real/agents/openai.yaml" ]; then
      pol="$(grep -c 'allow_implicit_invocation: *false' "$real/agents/openai.yaml")"
      if [ "$dmi" -gt 0 ] && [ "$pol" -eq 0 ]; then warn "$name: user-invoked no SKILL.md mas agents/openai.yaml sem allow_implicit_invocation: false"; ok; fi
      if [ "$dmi" -eq 0 ] && [ "$pol" -gt 0 ]; then warn "$name: user-invoked no openai.yaml mas SKILL.md sem disable-model-invocation: true"; ok; fi
    fi
    if [ "$dmi" -gt 0 ]; then
      # description de user-invoked não precisa de frases de trigger (face humana, não de modelo)
      if printf '%s' "$desc" | grep -qiE 'use when|use ao |aplique ao'; then
        warn "$name: user-invoked com description de modelo (frases de trigger): para user-invoked a description é humana"
      fi
    else
      # skill model-invoked necessita de condições de acionamento claras na descrição
      if printf '%s\n' "$desc" | grep -qiE 'use when|quando|use ao|aplique ao'; then
        ok
      else
        warn "$name: skill model-invoked necessita de condições de acionamento claras na descrição (termos: use when, quando, use ao, aplique ao)"
      fi
    fi

    # 4.4 alerta de sprawl e carga de contexto
    lines="$(wc -l < "$sk")"
    if [ "$lines" -gt 350 ] && [ ! -d "$real/references" ] && [ ! -d "$real/scripts" ]; then
      warn "$name: SKILL.md com $lines linhas sem references/ ou scripts/ (recomenda-se progressive disclosure: mover blocos extensos para references/)"
    else
      ok
    fi

    # 4.5 refs relativas do corpo resolvem (a skill deve ser autocontida)
    while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      [ -e "$real/$ref" ] || warn "$name: ref interna não existe: $ref"
    done < <(grep -oE '\((references|scripts|assets|agents)/[a-zA-Z0-9._/-]+\)' "$sk" | tr -d '()' | sort -u;
             grep -oE '`(references|scripts|assets|agents)/[a-zA-Z0-9._/-]+`' "$sk" | tr -d '`' | sort -u)

    # 4.6 dependências cross-skill nomeiam skills existentes
    while IFS= read -r dep; do
      [ -n "$dep" ] || continue
      if skill_exists "$dep"; then ok; else err "$name: chama a skill \"$dep\" que não existe"; fi
    done < <(grep -oE 'skill: *"([a-z0-9-]+)"' "$sk" | sed -E 's/skill: *"//; s/"//' | sort -u;
             grep -oE 'Skill tool with "([a-z0-9-]+)"' "$sk" | sed -E 's/.*with "//; s/"//' | sort -u)
  done
done

# ---------- 5. probes vivos ----------
echo "== 5. Probes vivos"
if command -v copilot >/dev/null 2>&1; then
  cout="$(cd "$HOME_DIR" && timeout -k 2s 5s copilot instruction list </dev/null 2>&1 || true)"
  if printf '%s' "$cout" | grep -q "AGENTS.md"; then ok
  else warn "copilot instruction list (na home) não lista o ~/AGENTS.md: regra global não chega"; fi
else warn "copilot não instalado: probe pulado"; fi
if command -v agent >/dev/null 2>&1; then ok; else warn "cursor CLI (agent) não instalado"; fi
if command -v opencode >/dev/null 2>&1; then ok; else warn "opencode não instalado"; fi

# ---------- 6. sync com o repo versionado ----------
echo "== 6. Sync repo ($REPO)"
if [ -d "$REPO/skills" ]; then
  [ -f "$REPO/ATTRIBUTION.md" ] && ok || err "repo sem ATTRIBUTION.md"
  [ -f "$REPO/LICENSE" ] && ok || err "repo sem LICENSE"
  for d in "$REPO"/skills/*/; do
    name="$(basename "$d")"
    # 6.1 toda skill do repo tem linha de atribuição
    grep -qE "(^|[^a-z0-9-])$name([^a-z0-9-]|$)" "$REPO/ATTRIBUTION.md" || warn "$name: sem entrada no ATTRIBUTION.md"
    # 6.2 se instalada, conteúdo igual ao repo
    inst="$AGENTS_SKILLS/$name"
    if [ -d "$inst" ] && [ ! -L "$inst" ]; then
      if diff -rq "$d" "$inst" >/dev/null 2>&1; then ok; else warn "$name: repo e ~/.agents/skills divergem (edite no repo e copie)"; fi
    fi
  done
  # 6.3 skill autoral instalada fora do repo (exceto privadas conhecidas)
  for e in "$AGENTS_SKILLS"/*; do
    name="$(basename "$e")"
    [ -d "$e" ] || continue
    case "$name" in
      ai-memory-*|sia-*|unslop|find-skills|graphify|omarchy|diagnose-crash|weekly-*|escreva-como-eu|error-to-detailed-issue) continue ;;
    esac
    [ -d "$REPO/skills/$name" ] || warn "$name: autoral instalada mas sem versão no repo"
  done
else
  warn "repo $REPO não encontrado: sync pulado"
fi

# ---------- resultado ----------
echo
if   [ "$errors" -gt 0 ]; then status="COM ERROS"
elif [ "$warnings" -gt 0 ]; then status="LIMPO COM AVISOS"
else status="CLEAN"; fi
echo "Resultado: $status ($checks checks, $errors erro(s), $warnings aviso(s))"
[ "$errors" -eq 0 ] || exit 1
exit 0
