#!/usr/bin/env bash
# Link each skill in skills/ to ~/.agents/skills/<name>, one symlink per skill.
# Usage: ./link.sh [--all | --default | -y | -h]
# Idempotent. Warns and skips existing directories and links pointing outside the repo.
set -euo pipefail
shopt -s nullglob

show_help() {
  cat <<'EOF'
Usage: ./link.sh [OPTIONS]

Links skills from this repository into agent skill directories.

Options:
  --all           Link to ~/.agents/skills and all detected CLI harnesses without prompting
  -y, --default   Link only to ~/.agents/skills (non-interactive mode)
  -h, --help      Show this help message

In interactive sessions without flags, detects installed harnesses (Claude Code,
Codex CLI, Gemini CLI) and prompts you to select where to link.
EOF
}

MODE="interactive"
while [[ $# -gt 0 ]]; do
  case "$1" in
    --all) MODE="all"; shift ;;
    -y|--yes|--default) MODE="default"; shift ;;
    -h|--help) show_help; exit 0 ;;
    *) echo "Unknown option: $1" >&2; show_help >&2; exit 1 ;;
  esac
done

checkout="$(cd "$(dirname "$0")" && pwd)"

# is_linked_worktree <dir>: true for a linked git worktree (its git dir differs
# from the common dir). Falls back to the .git file when git cannot read it.
is_linked_worktree() {
  local gd common
  if gd="$(git -C "$1" rev-parse --absolute-git-dir 2>/dev/null)" &&
     common="$(git -C "$1" rev-parse --git-common-dir 2>/dev/null)"; then
    case "$common" in /*) ;; *) common="$1/$common" ;; esac
    common="$(cd "$common" 2>/dev/null && pwd -P)" || return 1
    gd="$(cd "$gd" 2>/dev/null && pwd -P)" || return 1
    [ "$gd" != "$common" ]
    return
  fi
  [ -f "$1/.git" ] && grep -q '^gitdir: .*/worktrees/' "$1/.git"
}

# Installed skills must survive worktree removal: link only from the primary checkout.
if is_linked_worktree "$checkout"; then
  primary="$(git -C "$checkout" worktree list --porcelain 2>/dev/null | sed -n '1s/^worktree //p')" || primary=""
  echo "link.sh: $checkout is a linked git worktree; run it from the primary checkout (${primary:-unknown})." >&2
  exit 1
fi
repo="$checkout/skills"
# Other worktrees of this repository, one path per line.
worktrees="$(git -C "$checkout" worktree list --porcelain 2>/dev/null | sed -n 's/^worktree //p')" || worktrees=""

# repairable <link> <name>: the link points at this skill inside another worktree
# of this repository, or at a checkout that no longer exists. Either way it is
# safe to replace with a link to this checkout.
repairable() {
  local t wt
  t="$(readlink "$1")"
  case "$t" in /*/skills/"$2") ;; *) return 1 ;; esac
  while IFS= read -r wt; do
    [ -n "$wt" ] && [ "$wt" != "$checkout" ] || continue
    [ "$t" = "$wt/skills/$2" ] && return 0
  done <<WORKTREES
$worktrees
WORKTREES
  [ ! -e "$1" ] && [ ! -d "${t%/skills/$2}" ]
}
default="$HOME/.agents/skills"
dest="${AGENTS_SKILLS_DIR:-$default}"
mkdir -p "$dest"

echo "== Linking to shared agents root ($dest)"
for src in "$repo"/*/; do
  name="$(basename "$src")"
  target="$dest/$name"
  if [ -L "$target" ]; then
    case "$(readlink "$target")" in
      "$repo"/*) ;;
      *)
        if repairable "$target" "$name"; then
          echo "relinked: $target (was $(readlink "$target"))"
        else
          echo "skipped: $target points outside the repo" >&2; continue
        fi ;;
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

# Detect known harness skill roots
KNOWN_HARNESSES=(
  "$HOME/.claude/skills:Claude Code"
  "$HOME/.codex/skills:Codex CLI"
  "$HOME/.gemini/skills:Gemini CLI"
)

link_to_harness() {
  local harness_dir="$1"
  local harness_label="$2"
  echo
  echo "== Linking to $harness_label ($harness_dir)"
  mkdir -p "$harness_dir"
  for src in "$repo"/*/; do
    local name="$(basename "$src")"
    local target="$harness_dir/$name"
    local link_src
    if [ "$harness_dir" = "$HOME/.claude/skills" ]; then
      link_src="../../.agents/skills/$name"
    else
      link_src="$default/$name"
    fi

    if [ -L "$target" ]; then
      case "$(readlink "$target")" in
        "$link_src" | "$default/$name" | "$repo/$name" | "../../.agents/skills/$name") ;;
        *)
          if repairable "$target" "$name"; then
            echo "  relinked ($harness_label): $target (was $(readlink "$target"))"
          else
            echo "  skipped ($harness_label): $target points outside repo/agents" >&2; continue
          fi ;;
      esac
      ln -sfn "$link_src" "$target"
    elif [ -e "$target" ]; then
      echo "  skipped ($harness_label): $target exists and is not a symlink" >&2
      continue
    else
      ln -s "$link_src" "$target"
    fi
    echo "  ok ($harness_label): $name"
  done
}

if [ "$dest" = "$default" ]; then
  # Prune broken links in known harness roots
  for entry in "${KNOWN_HARNESSES[@]}"; do
    root="${entry%%:*}"
    prune "$root" "$default/*" "../../.agents/skills/*"
  done

  # Collect installed harnesses: the skill root is a real directory, or the
  # harness config directory exists and the skill root can be created in it.
  available_entries=()
  for entry in "${KNOWN_HARNESSES[@]}"; do
    dir="${entry%%:*}"
    if [ ! -L "$dir" ] && { [ -d "$dir" ] || { [ ! -e "$dir" ] && [ -d "$(dirname "$dir")" ]; }; }; then
      available_entries+=("$entry")
    fi
  done

  selected_entries=()
  if [ "${#available_entries[@]}" -gt 0 ]; then
    if [ "$MODE" = "all" ]; then
      selected_entries=("${available_entries[@]}")
    elif [ "$MODE" = "default" ]; then
      selected_entries=()
    elif [ -t 0 ] && [ -t 1 ]; then
      # Interactive prompt
      echo
      if command -v gum >/dev/null 2>&1; then
        options=()
        for entry in "${available_entries[@]}"; do
          dir="${entry%%:*}"
          label="${entry#*:}"
          options+=("$label ($dir)")
        done
        echo "Detected installed agent harnesses:"
        gum_out="$(gum choose --no-limit --selected="*" --cursor-prefix="→ " --selected-prefix="[✓] " --unselected-prefix="[ ] " --header="Select harnesses to link into (Space: toggle, Enter: confirm, Esc: skip):" "${options[@]}" 2>/dev/null || true)"
        for entry in "${available_entries[@]}"; do
          dir="${entry%%:*}"
          if echo "$gum_out" | grep -Fq "($dir)"; then
            selected_entries+=("$entry")
          fi
        done
      else
        echo "Detected installed agent harnesses:"
        idx=1
        for entry in "${available_entries[@]}"; do
          dir="${entry%%:*}"
          label="${entry#*:}"
          echo "  $idx) $label ($dir)"
          ((idx++))
        done
        read -r -p "Link skills to these harnesses as well? [A]ll / [n]one / numbers (e.g. 1,2) [default: All]: " answer
        answer="${answer:-A}"
        case "$answer" in
          [aA]*|[sS]*|[yY]*)
            selected_entries=("${available_entries[@]}")
            ;;
          [nN]*|[qQ]*)
            selected_entries=()
            ;;
          *)
            clean_answer="${answer//,/ }"
            for n in $clean_answer; do
              if [[ "$n" =~ ^[0-9]+$ ]] && [ "$n" -ge 1 ] && [ "$n" -le "${#available_entries[@]}" ]; then
                selected_entries+=("${available_entries[$((n-1))]}")
              fi
            done
            ;;
        esac
      fi
    fi
  fi

  for entry in "${selected_entries[@]}"; do
    dir="${entry%%:*}"
    label="${entry#*:}"
    link_to_harness "$dir" "$label"
  done
fi
