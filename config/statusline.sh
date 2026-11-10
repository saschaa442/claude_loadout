#!/bin/bash
# Claude Code status line (Catppuccin Mocha): model │ dir │ context bar │ 5h / 7d limits
input=$(cat)

# Catppuccin Mocha palette (truecolor)
c() { printf '\033[38;2;%sm' "$1"; }
MAUVE=$(c "203;166;247"); BLUE=$(c "137;180;250"); GREEN=$(c "166;227;161")
YELLOW=$(c "249;226;175"); PEACH=$(c "250;179;135"); RED=$(c "243;139;168")
TEAL=$(c "148;226;213"); TEXT=$(c "205;214;244"); SUB=$(c "166;173;200")
OVERLAY=$(c "108;112;134"); SURFACE=$(c "69;71;90"); RESET=$'\033[0m'
SEP="${OVERLAY} │ ${RESET}"

j() { echo "$input" | jq -r "$1" 2>/dev/null; }

model=$(j '.model.display_name // "?"')
effort=$(j '.effort.level // .effort // .reasoning_effort // empty')
[ -z "$effort" ] && effort=${CLAUDE_CODE_EFFORT_LEVEL:-}
[ -z "$effort" ] && effort=$(jq -r '.effortLevel // empty' ~/.claude/settings.json 2>/dev/null)
dir=$(basename "$(j '.workspace.current_dir // .cwd // "."')")

used=$(j '.context_window.total_input_tokens // empty')
size=$(j '.context_window.context_window_size // empty')
pct=$(j '.context_window.used_percentage // empty')

# Fallback: last assistant usage in transcript
if [ -z "$used" ]; then
  transcript=$(j '.transcript_path // empty')
  if [ -n "$transcript" ] && [ -f "$transcript" ]; then
    used=$(tail -n 200 "$transcript" | jq -s -r '
      [.[] | select(.type == "assistant" and .message.usage != null) | .message.usage]
      | last
      | if . == null then empty else
          ((.input_tokens // 0) + (.cache_creation_input_tokens // 0) + (.cache_read_input_tokens // 0))
        end' 2>/dev/null)
  fi
fi
[ -z "$used" ] && used=0
[ -z "$size" ] && size=200000
[ -z "$pct" ] && pct=$(awk -v u="$used" -v s="$size" 'BEGIN{printf "%d", (s>0 ? u*100/s : 0)}')
pct=$(printf '%.0f' "$pct")

fmt() {
  awk -v n="$1" 'BEGIN{
    if (n >= 1000000) printf "%.1fM", n/1000000;
    else if (n >= 1000) printf "%.1fk", n/1000;
    else printf "%d", n }' | sed 's/\.0\([kM]\)/\1/'
}

# Color by percentage
pcolor() {
  if   [ "$1" -lt 50 ]; then printf '%s' "$GREEN"
  elif [ "$1" -lt 75 ]; then printf '%s' "$YELLOW"
  elif [ "$1" -lt 90 ]; then printf '%s' "$PEACH"
  else printf '%s' "$RED"; fi
}

# Progress bar: bar <pct> <width>
bar() {
  local p=$1 w=${2:-10} filled empty out=""
  filled=$(( (p * w + 50) / 100 )); [ $filled -gt $w ] && filled=$w
  empty=$(( w - filled ))
  out="$(pcolor "$p")"
  for ((i=0; i<filled; i++)); do out+="█"; done
  out+="$SURFACE"
  for ((i=0; i<empty; i++)); do out+="█"; done
  printf '%s%s' "$out" "$RESET"
}

# Remaining time until reset (accepts epoch seconds or ISO-8601)
until_reset() {
  local ts=$1 now diff
  [ -z "$ts" ] && return
  if ! [[ "$ts" =~ ^[0-9]+$ ]]; then
    ts=$(echo "\"$ts\"" | jq -r 'sub("\\.[0-9]+"; "") | sub("(Z|[+-]00:?00)$"; "") | strptime("%Y-%m-%dT%H:%M:%S") | mktime' 2>/dev/null)
    [ -z "$ts" ] && return
  fi
  now=$(date +%s); diff=$(( ts - now )); [ $diff -lt 0 ] && diff=0
  if   [ $diff -ge 86400 ]; then printf '%dd%dh' $((diff/86400)) $((diff%86400/3600))
  elif [ $diff -ge 3600 ];  then printf '%dh%02dm' $((diff/3600)) $((diff%3600/60))
  else printf '%dm' $((diff/60)); fi
}

# Rate-limit segment: limit <label> <jq-path>
limit() {
  local p r t
  p=$(j "$2.used_percentage // $2.utilization // empty")
  [ -z "$p" ] && return
  p=$(printf '%.0f' "$p")
  r=$(j "$2.resets_at // empty")
  t=$(until_reset "$r")
  printf '%s%s %s%s%%%s' "$SUB" "$1" "$(pcolor "$p")" "$p" "$RESET"
  [ -n "$t" ] && printf ' %s↻ %s%s' "$OVERLAY" "$t" "$RESET"
}

out="${MAUVE}${model}${RESET}${SEP}"
[ -n "$effort" ] && out+="${PEACH}${effort}${RESET}${SEP}"
out+="${BLUE}${dir}${RESET}${SEP}"
out+="$(bar "$pct" 10) ${TEXT}$(fmt "$used")${OVERLAY}/${SUB}$(fmt "$size")${RESET} $(pcolor "$pct")${pct}%${RESET}"

five=$(limit "5h" ".rate_limits.five_hour")
week=$(limit "7d" ".rate_limits.seven_day")
[ -n "$five" ] && out+="${SEP}${five}"
[ -n "$week" ] && out+="${SEP}${week}"

printf '%s' "$out"
