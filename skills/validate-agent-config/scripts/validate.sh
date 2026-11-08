#!/usr/bin/env bash
# validate-agent-config: check harness entry points, the shared rules file,
# skill roots, SKILL.md conventions, and sync with this repository.
# Machine-specific settings come from an optional config file; see SKILL.md.
set -u
HOME_DIR="${HOME:?}"
AGENTS_SKILLS="$HOME_DIR/.agents/skills"
CLAUDE_SKILLS="$HOME_DIR/.claude/skills"

# Defaults. The config file may override any of them.
CONTEXT=""               # shared rules file that harness entry points link to or import
CLAUDE_DIRS=("$HOME_DIR/.claude")  # Claude Code config dirs whose CLAUDE.md imports are checked
CONTEXT_BINARIES=""      # ERE: binaries named in CONTEXT that must be on PATH
COPILOT_MARKER=""        # text that ~/.copilot/copilot-instructions.md must contain
EXPECTED_TOOLS=()        # CLIs whose absence is a warning
IGNORE_SKILLS=()         # glob patterns exempt from the skill-root layout checks
CHECK_UNPUBLISHED=0      # 1: warn about installed skills that are missing from the repository
LOCAL_ONLY_SKILLS=()     # glob patterns exempt from that check
SKILLS_REPO="${SKILLS_REPO:-}"

CONFIG="${VALIDATE_AGENT_CONFIG:-${XDG_CONFIG_HOME:-$HOME_DIR/.config}/validate-agent-config/config.sh}"
# shellcheck source=/dev/null
if [ -f "$CONFIG" ]; then . "$CONFIG"; fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
REPO_FROM_SCRIPT="$(cd "$SCRIPT_DIR/../../.." 2>/dev/null && pwd)"
if [ -n "$SKILLS_REPO" ]; then
  REPO="$SKILLS_REPO"
elif [ -d "$REPO_FROM_SCRIPT/skills" ] && [ -f "$REPO_FROM_SCRIPT/ATTRIBUTION.md" ]; then
  REPO="$REPO_FROM_SCRIPT"
else
  REPO=""
fi

errors=0; warnings=0; checks=0

err()  { checks=$((checks+1)); errors=$((errors+1));   echo "ERROR:  $*"; }
warn() { checks=$((checks+1)); warnings=$((warnings+1)); echo "WARNING: $*"; }
ok()   { checks=$((checks+1)); }

resolve() { readlink -f "$1" 2>/dev/null; }
skill_exists() { [ -e "$AGENTS_SKILLS/$1" ] || [ -e "$CLAUDE_SKILLS/$1" ]; }
# matches_any <name> <glob>...: true when name matches one of the globs
matches_any() {
  local name="$1" pat; shift
  for pat in "$@"; do
    # shellcheck disable=SC2254
    case "$name" in $pat) return 0 ;; esac
  done
  return 1
}
ignored() { matches_any "$1" ${IGNORE_SKILLS[@]+"${IGNORE_SKILLS[@]}"}; }

# ---------- 1. instruction entry points ----------
echo "== 1. Instruction entry points"
if [ -n "$CONTEXT" ] && [ ! -f "$CONTEXT" ]; then
  err "shared rules file $CONTEXT does not exist"
fi

# <harness config dir>:<entry file that should link to CONTEXT>
ENTRY_POINTS=(
  "$HOME_DIR:$HOME_DIR/AGENTS.md"
  "$HOME_DIR/.config/opencode:$HOME_DIR/.config/opencode/AGENTS.md"
  "$HOME_DIR/.codex:$HOME_DIR/.codex/AGENTS.md"
  "$HOME_DIR/.gemini:$HOME_DIR/.gemini/GEMINI.md"
  "$HOME_DIR/.grok:$HOME_DIR/.grok/AGENTS.md"
)
for entry in "${ENTRY_POINTS[@]}"; do
  dir="${entry%%:*}"; f="${entry#*:}"
  [ -d "$dir" ] || continue
  if [ -L "$f" ] && [ ! -e "$f" ]; then err "broken symlink: $f -> $(readlink "$f")"; continue; fi
  [ -n "$CONTEXT" ] || continue
  if [ -L "$f" ]; then
    if [ "$(resolve "$f")" = "$(resolve "$CONTEXT")" ]; then ok
    else err "$f resolves to $(resolve "$f"), expected $CONTEXT"; fi
  elif [ -e "$f" ]; then warn "$f exists but is NOT a symlink (should point to $CONTEXT)"
  else err "$f does not exist (should be a symlink to $CONTEXT)"; fi
done

for d in "${CLAUDE_DIRS[@]}"; do
  f="$d/CLAUDE.md"
  if [ ! -e "$f" ] && [ ! -L "$f" ]; then
    [ -z "$CONTEXT" ] || err "$f does not exist (should be a REAL file with @import)"
    continue
  fi
  if [ -L "$f" ]; then
    if [ -n "$CONTEXT" ]; then err "$f should be a REAL file with @import, not a symlink"; continue; fi
    [ -e "$f" ] || { err "broken symlink: $f -> $(readlink "$f")"; continue; }
  fi
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

if [ -n "$COPILOT_MARKER" ]; then
  CI="$HOME_DIR/.copilot/copilot-instructions.md"
  if [ -f "$CI" ]; then
    grep -qF "$COPILOT_MARKER" "$CI" && ok || warn "$CI lacks the '$COPILOT_MARKER' block (Copilot misses global rules in projects)"
  else err "$CI does not exist"; fi
fi

# ---------- 2. shared rules file hygiene ----------
if [ -n "$CONTEXT" ] && [ -f "$CONTEXT" ]; then
  echo "== 2. Paths and binaries referenced in $CONTEXT"
  while IFS= read -r p; do
    [ -n "$p" ] || continue
    [ -e "$HOME_DIR${p#\~}" ] || warn "path referenced in $(basename "$CONTEXT") does not exist: $p"
  done < <(grep -oE '~(/[a-zA-Z0-9._/-]+)' "$CONTEXT" | sort -u)

  while IFS= read -r p; do
    [ -n "$p" ] || continue
    [ -e "$HOME_DIR${p#\~}" ] || err "skill referenced in $(basename "$CONTEXT") does not exist: $p"
  done < <(grep -oE '~/\.?[a-zA-Z0-9._/-]*skills/[a-zA-Z0-9._-]+/SKILL\.md' "$CONTEXT" | sort -u)

  if [ -n "$CONTEXT_BINARIES" ]; then
    while IFS= read -r b; do
      [ -n "$b" ] || continue
      command -v "$b" >/dev/null 2>&1 || warn "binary referenced in $(basename "$CONTEXT") is not on PATH: $b"
    done < <(grep -oE "$CONTEXT_BINARIES" "$CONTEXT" | sort -u)
  fi
else
  echo "== 2. Shared rules file (skipped: CONTEXT not configured)"
fi

# ---------- 3. skills: structure ----------
echo "== 3. Skills (structure)"
for root in "$AGENTS_SKILLS" "$CLAUDE_SKILLS"; do
  [ -d "$root" ] || { [ "$root" = "$CLAUDE_SKILLS" ] && [ ! -d "$HOME_DIR/.claude" ] && continue; err "missing skill root: $root"; continue; }
  for e in "$root"/*; do
    [ -e "$e" ] || [ -L "$e" ] || continue
    name="$(basename "$e")"
    ignored "$name" && continue
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
  ignored "$name" && continue
  c="$CLAUDE_SKILLS/$name"
  if [ -d "$c" ] && [ ! -L "$c" ]; then
    err "$name is a REAL directory in both roots (drift); one must be a symlink"
  else ok; fi
done

for e in "$CLAUDE_SKILLS"/*; do
  name="$(basename "$e")"
  [ -d "$e" ] && [ ! -L "$e" ] || continue
  ignored "$name" && continue
  [ -e "$AGENTS_SKILLS/$name" ] || warn "$name is a real directory only in ~/.claude/skills; consider moving it to ~/.agents/skills"
done

# ---------- 4. skills: SKILL.md lint (conventions) ----------
lint_skill_dir() {
  local real="$1"
  local name sk desc dmi pol fm_name lines ref dep
  name="$(basename "$real")"
  sk="$real/SKILL.md"
  [ -f "$sk" ] || return 0

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

  # 4.4 sprawl warning and context load (applies even when references/ or scripts/ exist)
  lines="$(wc -l < "$sk" | tr -d ' ')"
  if [ "$lines" -gt 350 ]; then
    warn "$name: SKILL.md has $lines lines (disclose into references/; threshold applies even when references/ or scripts/ exist)"
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
}

echo "== 4. Skills (content lint)"
for root in "$AGENTS_SKILLS" "$CLAUDE_SKILLS"; do
  for e in "$root"/*; do
    [ -L "$e" ] && continue
    [ -f "$e/SKILL.md" ] || continue
    lint_skill_dir "$e"
  done
done
if [ -n "$REPO" ] && [ -d "$REPO/skills" ]; then
  for d in "$REPO"/skills/*/; do
    [ -f "$d/SKILL.md" ] || continue
    lint_skill_dir "${d%/}"
  done
fi

# ---------- 5. live probes ----------
echo "== 5. Live probes"
if [ -n "$CONTEXT" ] && command -v copilot >/dev/null 2>&1; then
  cout="$(cd "$HOME_DIR" && timeout -k 2s 5s copilot instruction list </dev/null 2>&1 || true)"
  if printf '%s' "$cout" | grep -q "AGENTS.md"; then ok
  else warn "copilot instruction list (in the home directory) does not list ~/AGENTS.md; the global rule will not load"; fi
fi
for t in ${EXPECTED_TOOLS[@]+"${EXPECTED_TOOLS[@]}"}; do
  if command -v "$t" >/dev/null 2>&1; then ok; else warn "$t is not on PATH"; fi
done

# ---------- 6. sync with the versioned repository ----------
if [ -n "$REPO" ] && [ -d "$REPO/skills" ]; then
  echo "== 6. Repository sync ($REPO)"
  [ -f "$REPO/ATTRIBUTION.md" ] && ok || err "repository missing ATTRIBUTION.md"
  [ -f "$REPO/LICENSE" ] && ok || err "repository missing LICENSE"
  for d in "$REPO"/skills/*/; do
    [ -d "$d" ] || continue
    name="$(basename "$d")"
    # 6.1 every repository skill has an attribution entry
    grep -qE "(^|[^a-z0-9-])$name([^a-z0-9-]|$)" "$REPO/ATTRIBUTION.md" || warn "$name: missing entry in ATTRIBUTION.md"
    # 6.2 an installed copy (not a symlink) matches the repository
    inst="$AGENTS_SKILLS/$name"
    if [ -d "$inst" ] && [ ! -L "$inst" ]; then
      if diff -rq "$d" "$inst" >/dev/null 2>&1; then ok; else warn "$name: repository and ~/.agents/skills differ (edit in the repository and copy)"; fi
    fi
  done
  # 6.3 installed skills missing from the repository (opt-in)
  if [ "$CHECK_UNPUBLISHED" = 1 ]; then
    for e in "$AGENTS_SKILLS"/*; do
      name="$(basename "$e")"
      [ -d "$e" ] || continue
      ignored "$name" && continue
      matches_any "$name" ${LOCAL_ONLY_SKILLS[@]+"${LOCAL_ONLY_SKILLS[@]}"} && continue
      [ -d "$REPO/skills/$name" ] || warn "$name: installed but missing from the repository"
    done
  fi
else
  echo "== 6. Repository sync (skipped: no repository found; set SKILLS_REPO)"
fi

# ---------- result ----------
echo
if   [ "$errors" -gt 0 ]; then status="WITH ERRORS"
elif [ "$warnings" -gt 0 ]; then status="CLEAN WITH WARNINGS"
else status="CLEAN"; fi
echo "Result: $status ($checks checks, $errors error(s), $warnings warning(s))"
[ "$errors" -eq 0 ] || exit 1
exit 0
