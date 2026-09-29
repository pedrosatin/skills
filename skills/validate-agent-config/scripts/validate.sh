#!/usr/bin/env bash
# validate-agent-config: validate instruction entry points, CONTEXT.md, skills, and repository sync
# Layout source of truth: ~/.agents/SKILLS.md and the header of ~/.agents/CONTEXT.md
# Invocation conventions (user-invoked vs model-invoked): mattpocock/skills .agents/invocation.md
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

err()  { checks=$((checks+1)); errors=$((errors+1));   echo "ERROR:  $*"; }
warn() { checks=$((checks+1)); warnings=$((warnings+1)); echo "WARNING: $*"; }
ok()   { checks=$((checks+1)); }

resolve() { readlink -f "$1" 2>/dev/null; }
skill_exists() { [ -e "$AGENTS_SKILLS/$1" ] || [ -e "$CLAUDE_SKILLS/$1" ]; }

# ---------- 1. instruction entry points ----------
echo "== 1. Instruction entry points"
[ -f "$CONTEXT" ] || { echo "ERROR:  missing $CONTEXT"; exit 1; }

for f in "$HOME_DIR/AGENTS.md" \
         "$HOME_DIR/.config/opencode/AGENTS.md" \
         "$HOME_DIR/.codex/AGENTS.md" \
         "$HOME_DIR/.gemini/GEMINI.md" \
         "$HOME_DIR/.grok/AGENTS.md"; do
  if [ -L "$f" ] && [ -e "$f" ]; then
    if [ "$(resolve "$f")" = "$CONTEXT" ]; then ok
    else err "$(basename "$(dirname "$f")")/$(basename "$f") resolves to $(resolve "$f"), expected $CONTEXT"; fi
  elif [ -e "$f" ]; then warn "$f exists but is NOT a symlink (should point to CONTEXT.md)"
  else err "$f does not exist"; fi
done

for f in "$HOME_DIR/.claude/CLAUDE.md" "$HOME_DIR/.claude-w/CLAUDE.md" "$HOME_DIR/.claude-p/CLAUDE.md"; do
  if [ ! -f "$f" ] || [ -L "$f" ]; then err "$f should be a REAL file with @import (missing or a symlink)"; continue; fi
  ok
  while IFS= read -r ref; do
    [ -n "$ref" ] || continue
    case "$ref" in
      "~/"*) target="$HOME_DIR/${ref:2}" ;;
      "/"*)  target="$ref" ;;
      *)     target="$(dirname "$f")/$ref" ;;
    esac
    if [ -e "$target" ]; then ok; else err "import @$ref in $f does not resolve ($target)"; fi
  done < <(grep -E '^@' "$f" | sed 's/^@//' | sed 's/\r$//')
done

CI="$HOME_DIR/.copilot/copilot-instructions.md"
if [ -f "$CI" ]; then
  grep -q "context-global-pointer" "$CI" && ok || warn "$CI missing the context-global-pointer block (Copilot misses global rules in projects)"
else err "$CI does not exist"; fi

# ---------- 2. CONTEXT.md hygiene ----------
echo "== 2. Paths and binaries referenced in CONTEXT.md"
while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$HOME_DIR${p#\~}" ] || warn "path referenced in CONTEXT.md does not exist: $p"
done < <(grep -oE '~(/[a-zA-Z0-9._/-]+)' "$CONTEXT" | sort -u)

while IFS= read -r p; do
  [ -n "$p" ] || continue
  [ -e "$HOME_DIR${p#\~}" ] || err "skill referenced in CONTEXT.md does not exist: $p"
done < <(grep -oE '~/\.?[a-zA-Z0-9._/-]*skills/[a-zA-Z0-9._-]+/SKILL\.md' "$CONTEXT" | sort -u)

while IFS= read -r b; do
  [ -n "$b" ] || continue
  command -v "$b" >/dev/null 2>&1 || warn "binary referenced in CONTEXT.md is not on PATH: $b"
done < <(grep -oE '\b[a-z]+(-[a-z]+)*-axi\b|\brtk\b' "$CONTEXT" | sort -u)

# ---------- 3. skills: structure ----------
echo "== 3. Skills (structure)"
for root in "$AGENTS_SKILLS" "$CLAUDE_SKILLS"; do
  [ -d "$root" ] || { err "missing skill root: $root"; continue; }
  for e in "$root"/*; do
    name="$(basename "$e")"
    [ "$name" = "synced" ] && continue
    if [ -L "$e" ]; then
      if [ -e "$e" ]; then ok; else err "broken symlink: $e -> $(readlink "$e")"; fi
      continue
    fi
    [ -d "$e" ] || continue
    if [ ! -f "$e/SKILL.md" ]; then err "$name ($root): directory without SKILL.md"; continue; fi
    ok
  done
done

for e in "$AGENTS_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  c="$CLAUDE_SKILLS/$name"
  if [ -d "$c" ] && [ ! -L "$c" ]; then
    case "$name" in ai-memory-*) ok ;; *) err "$name is a REAL directory in both roots (drift); one must be a symlink" ;; esac
  fi
done

for e in "$CLAUDE_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  case "$name" in ai-memory-*|synced) continue ;; esac
  [ -e "$AGENTS_SKILLS/$name" ] || warn "$name is a real directory only in ~/.claude/skills; consider moving it to ~/.agents/skills"
done

# ---------- 4. skills: SKILL.md lint (conventions) ----------
echo "== 4. Skills (content lint)"
for root in "$AGENTS_SKILLS" "$CLAUDE_SKILLS"; do
  for e in "$root"/*; do
    [ -L "$e" ] && continue
    [ -f "$e/SKILL.md" ] || continue
    name="$(basename "$e")"
    real="$e"
    sk="$real/SKILL.md"

    # 4.1 ID: kebab-case, <=64 (portable standard; recommended by OpenCode)
    if ! printf '%s' "$name" | grep -qE '^[a-z0-9]+(-[a-z0-9]+)*$'; then
      warn "ID is not kebab-case: $name"
    else ok; fi
    [ "${#name}" -le 64 ] || warn "ID exceeds 64 characters: $name"

    # 4.2 frontmatter fields and name matching the directory
    head -c 2000 "$sk" | grep -q '^description:' || warn "$name: frontmatter missing description (skill is not advertised to the model)"
    head -c 2000 "$sk" | grep -q '^name:' || warn "$name: frontmatter missing name"
    fm_name="$(awk '
      BEGIN { in_fm=0 }
      /^---[[:space:]]*$/ {
        if (!in_fm) { in_fm=1; next }
        else exit
      }
      in_fm && /^name:[[:space:]]*/ {
        sub(/^name:[[:space:]]*/, "")
        sub(/^[[:space:]]+/, "")
        sub(/^["'\''"]/, ""); sub(/["'\''"][[:space:]]*$/, "")
        sub(/[[:space:]]+$/, "")
        print
        exit
      }
    ' "$sk")"
    if [ "$fm_name" = "$name" ]; then
      ok
    else
      err "$name: name field differs from the directory (name: '$fm_name')"
    fi

    # extract the complete description block (including multiline blocks with | or >)
    desc="$(awk '
      BEGIN { in_fm=0; in_desc=0 }
      /^---[[:space:]]*$/ {
        if (!in_fm) { in_fm=1; next }
        else { exit }
      }
      in_fm && /^description:[[:space:]]*/ {
        in_desc=1
        sub(/^description:[[:space:]]*/, "")
        if ($0 ~ /^[|>][-+0-9]*[[:space:]]*$/) next
        sub(/^["'\''"]/, ""); sub(/["'\''"][[:space:]]*$/, "")
        if (length($0) > 0) print
        next
      }
      in_fm && in_desc {
        if (/^[a-zA-Z0-9_-]+:[[:space:]]*/) exit
        sub(/^[[:space:]]+/, "")
        sub(/^["'\''"]/, ""); sub(/["'\''"][[:space:]]*$/, "")
        if (length($0) > 0) print
      }
    ' "$sk")"
    [ "${#desc}" -le 1024 ] || warn "$name: description has ${#desc} characters (increases context token use in every session)"

    # 4.3 invocation parity and trigger checks
    dmi="$(grep -c '^disable-model-invocation: *true' "$sk")"
    if [ -f "$real/agents/openai.yaml" ]; then
      pol="$(grep -c 'allow_implicit_invocation: *false' "$real/agents/openai.yaml")"
      if [ "$dmi" -gt 0 ] && [ "$pol" -eq 0 ]; then
        warn "$name: user-invoked in SKILL.md but agents/openai.yaml lacks allow_implicit_invocation: false"
      elif [ "$dmi" -eq 0 ] && [ "$pol" -gt 0 ]; then
        warn "$name: user-invoked in openai.yaml but SKILL.md lacks disable-model-invocation: true"
      else
        ok
      fi
    fi
    if [ "$dmi" -gt 0 ]; then
      # user-invoked descriptions do not need trigger phrases (intended for the operator)
      if printf '%s' "$desc" | grep -qiE 'use when|use ao |aplique ao'; then
        warn "$name: user-invoked with a model-facing description (trigger phrases); user-invoked descriptions are intended for the operator"
      fi
    else
      # model-invoked skills require clear activation conditions in the description
      if printf '%s\n' "$desc" | grep -qiE 'use when|quando|use ao|aplique ao'; then
        ok
      else
        warn "$name: model-invoked skills require clear activation conditions in the description (terms: use when, quando, use ao, aplique ao)"
      fi
    fi

    # 4.4 sprawl warning and context load
    lines="$(wc -l < "$sk")"
    if [ "$lines" -gt 350 ] && [ ! -d "$real/references" ] && [ ! -d "$real/scripts" ]; then
      warn "$name: SKILL.md has $lines lines without references/ or scripts/ (move long sections to references/)"
    else
      ok
    fi

    # 4.5 relative references in the body resolve (the skill should be self-contained)
    while IFS= read -r ref; do
      [ -n "$ref" ] || continue
      [ -e "$real/$ref" ] || warn "$name: internal reference does not exist: $ref"
    done < <(grep -oE '\]\((references|scripts|assets|agents)/[a-zA-Z0-9._/-]+\)' "$sk" | sed -E 's/^\]\(//; s/\)$//' | sort -u;
             grep -oE '`(references|scripts|assets|agents)/[a-zA-Z0-9._/-]+`' "$sk" | tr -d '`' | sort -u)

    # 4.6 cross-skill dependencies name existing skills
    while IFS= read -r dep; do
      [ -n "$dep" ] || continue
      if skill_exists "$dep"; then ok; else err "$name: calls skill \"$dep\" which does not exist"; fi
    done < <(grep -oE 'skill: *"([a-z0-9-]+)"' "$sk" | sed -E 's/skill: *"//; s/"//' | sort -u;
             grep -oE 'Skill tool with "([a-z0-9-]+)"' "$sk" | sed -E 's/.*with "//; s/"//' | sort -u)
  done
done

# ---------- 5. live probes ----------
echo "== 5. Live probes"
if command -v copilot >/dev/null 2>&1; then
  cout="$(cd "$HOME_DIR" && timeout -k 2s 5s copilot instruction list </dev/null 2>&1 || true)"
  if printf '%s' "$cout" | grep -q "AGENTS.md"; then ok
  else warn "copilot instruction list (in the home directory) does not list ~/AGENTS.md; the global rule will not load"; fi
else warn "copilot is not installed; probe skipped"; fi
if command -v agent >/dev/null 2>&1; then ok; else warn "Cursor CLI (agent) is not installed"; fi
if command -v opencode >/dev/null 2>&1; then ok; else warn "opencode is not installed"; fi

# ---------- 6. sync with the versioned repository ----------
echo "== 6. Repository sync ($REPO)"
if [ -d "$REPO/skills" ]; then
  [ -f "$REPO/ATTRIBUTION.md" ] && ok || err "repository missing ATTRIBUTION.md"
  [ -f "$REPO/LICENSE" ] && ok || err "repository missing LICENSE"
  for d in "$REPO"/skills/*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    # 6.1 every repository skill has an attribution entry
    grep -qE "(^|[^a-z0-9-])$name([^a-z0-9-]|$)" "$REPO/ATTRIBUTION.md" || warn "$name: missing entry in ATTRIBUTION.md"
    # 6.2 if installed, contents match the repository
    inst="$AGENTS_SKILLS/$name"
    if [ -d "$inst" ] && [ ! -L "$inst" ]; then
      if diff -rq "$d" "$inst" >/dev/null 2>&1; then ok; else warn "$name: repository and ~/.agents/skills differ (edit in the repository and copy)"; fi
    fi
  done
  # 6.3 locally authored skill installed outside the repository (except known private skills)
  for e in "$AGENTS_SKILLS"/*; do
    name="$(basename "$e")"
    [ -d "$e" ] || continue
    case "$name" in
      ai-memory-*|sia-*|unslop|find-skills|graphify|omarchy|diagnose-crash|weekly-*|escreva-como-eu|error-to-detailed-issue) continue ;;
    esac
    [ -d "$REPO/skills/$name" ] || warn "$name: locally authored and installed but missing from the repository"
  done
else
  warn "repository $REPO not found; sync skipped"
fi

# ---------- result ----------
echo
if   [ "$errors" -gt 0 ]; then status="WITH ERRORS"
elif [ "$warnings" -gt 0 ]; then status="CLEAN WITH WARNINGS"
else status="CLEAN"; fi
echo "Result: $status ($checks checks, $errors error(s), $warnings warning(s))"
[ "$errors" -eq 0 ] || exit 1
exit 0
