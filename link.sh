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

repo="$(cd "$(dirname "$0")" && pwd)/skills"
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
        *) echo "  skipped ($harness_label): $target points outside repo/agents" >&2; continue ;;
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

  # Collect available harnesses (existing real directories)
  available_entries=()
  for entry in "${KNOWN_HARNESSES[@]}"; do
    dir="${entry%%:*}"
    if [ -d "$dir" ] && [ ! -L "$dir" ]; then
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
