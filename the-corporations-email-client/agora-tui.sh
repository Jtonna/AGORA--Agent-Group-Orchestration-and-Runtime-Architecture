#!/bin/bash
#
# AGORA Orchestration Dashboard - Terminal UI
# Pure Bash implementation (no jq required)
#

# =============================================================================
# CONFIGURATION
# =============================================================================
API_BASE="http://localhost:60061"
REFRESH_INTERVAL=5
AGENTS=("mike" "jamie" "justin")
AGENT_ROLES=("Manager" "Employee" "Tech Lead")

# =============================================================================
# ANSI COLOR CODES
# =============================================================================
RESET="\033[0m"
BOLD="\033[1m"
DIM="\033[2m"

# Foreground colors
BLACK="\033[30m"
RED="\033[31m"
GREEN="\033[32m"
YELLOW="\033[33m"
BLUE="\033[34m"
MAGENTA="\033[35m"
CYAN="\033[36m"
WHITE="\033[37m"

# Bright colors
BRIGHT_RED="\033[91m"
BRIGHT_GREEN="\033[92m"
BRIGHT_YELLOW="\033[93m"
BRIGHT_CYAN="\033[96m"
BRIGHT_WHITE="\033[97m"

# Background colors
BG_BLACK="\033[40m"
BG_BLUE="\033[44m"

# =============================================================================
# BOX DRAWING CHARACTERS (Unicode)
# =============================================================================
BOX_TL="╔"  # Top-left
BOX_TR="╗"  # Top-right
BOX_BL="╚"  # Bottom-left
BOX_BR="╝"  # Bottom-right
BOX_H="═"   # Horizontal
BOX_V="║"   # Vertical
BOX_LT="╠"  # Left-T
BOX_RT="╣"  # Right-T

# Light box characters for agent cards
CARD_TL="┌"
CARD_TR="┐"
CARD_BL="└"
CARD_BR="┘"
CARD_H="─"
CARD_V="│"

# Status indicator
BULLET="●"

# =============================================================================
# SCREEN UTILITIES
# =============================================================================
clear_screen() {
    printf "\033[2J"
}

move_cursor() {
    local row=$1
    local col=$2
    printf "\033[${row};${col}H"
}

hide_cursor() {
    printf "\033[?25l"
}

show_cursor() {
    printf "\033[?25h"
}

save_cursor() {
    printf "\033[s"
}

restore_cursor() {
    printf "\033[u"
}

get_terminal_size() {
    TERM_ROWS=$(tput lines)
    TERM_COLS=$(tput cols)
}

# =============================================================================
# DRAWING UTILITIES
# =============================================================================
draw_horizontal_line() {
    local row=$1
    local col=$2
    local width=$3
    local char=${4:-$BOX_H}

    move_cursor "$row" "$col"
    for ((i=0; i<width; i++)); do
        printf "%s" "$char"
    done
}

draw_text() {
    local row=$1
    local col=$2
    local text=$3
    local color=${4:-$RESET}

    move_cursor "$row" "$col"
    printf "${color}%s${RESET}" "$text"
}

draw_text_centered() {
    local row=$1
    local width=$2
    local text=$3
    local color=${4:-$RESET}

    local text_len=${#text}
    local col=$(( (width - text_len) / 2 + 1 ))

    move_cursor "$row" "$col"
    printf "${color}%s${RESET}" "$text"
}

pad_right() {
    local text=$1
    local width=$2
    local len=${#text}
    local padding=$((width - len))

    printf "%s" "$text"
    for ((i=0; i<padding; i++)); do
        printf " "
    done
}

truncate_text() {
    local text=$1
    local max_len=$2

    if [[ ${#text} -gt $max_len ]]; then
        echo "${text:0:$((max_len-3))}..."
    else
        echo "$text"
    fi
}

# =============================================================================
# MAIN FRAME DRAWING
# =============================================================================
draw_main_frame() {
    local width=$TERM_COLS
    local height=$TERM_ROWS

    # Top border
    move_cursor 1 1
    printf "${CYAN}${BOX_TL}"
    for ((i=2; i<width; i++)); do printf "${BOX_H}"; done
    printf "${BOX_TR}${RESET}"

    # Title
    draw_text_centered 1 "$width" " AGORA ORCHESTRATION DASHBOARD " "${BOLD}${BRIGHT_CYAN}"

    # Side borders for entire frame
    for ((row=2; row<height; row++)); do
        move_cursor "$row" 1
        printf "${CYAN}${BOX_V}${RESET}"
        move_cursor "$row" "$width"
        printf "${CYAN}${BOX_V}${RESET}"
    done

    # Separator after agents section (row 10)
    move_cursor 10 1
    printf "${CYAN}${BOX_LT}"
    for ((i=2; i<width; i++)); do printf "${BOX_H}"; done
    printf "${BOX_RT}${RESET}"

    # Separator before controls (row height-2)
    local ctrl_row=$((height - 2))
    move_cursor "$ctrl_row" 1
    printf "${CYAN}${BOX_LT}"
    for ((i=2; i<width; i++)); do printf "${BOX_H}"; done
    printf "${BOX_RT}${RESET}"

    # Bottom border
    move_cursor "$height" 1
    printf "${CYAN}${BOX_BL}"
    for ((i=2; i<width; i++)); do printf "${BOX_H}"; done
    printf "${BOX_BR}${RESET}"
}

# =============================================================================
# AGENT CARD DRAWING
# =============================================================================
draw_agent_card() {
    local row=$1
    local col=$2
    local name=$3
    local role=$4
    local inbox=$5
    local unread=$6
    local status=$7  # active, waiting, blocked

    local width=16

    # Determine status color
    local status_color
    case $status in
        active)  status_color="$GREEN" ;;
        waiting) status_color="$YELLOW" ;;
        blocked) status_color="$RED" ;;
        *)       status_color="$DIM" ;;
    esac

    # Top border
    move_cursor "$row" "$col"
    printf "${WHITE}${CARD_TL}"
    for ((i=0; i<width-2; i++)); do printf "${CARD_H}"; done
    printf "${CARD_TR}${RESET}"

    # Name row
    move_cursor "$((row+1))" "$col"
    printf "${WHITE}${CARD_V}${RESET} ${BOLD}%-$((width-4))s${RESET} ${WHITE}${CARD_V}${RESET}" "$(echo "$name" | tr '[:lower:]' '[:upper:]')"

    # Role row with status indicator
    move_cursor "$((row+2))" "$col"
    printf "${WHITE}${CARD_V}${RESET} ${status_color}${BULLET}${RESET} %-$((width-6))s ${WHITE}${CARD_V}${RESET}" "$role"

    # Inbox count
    move_cursor "$((row+3))" "$col"
    printf "${WHITE}${CARD_V}${RESET} Inbox: %-$((width-10))s ${WHITE}${CARD_V}${RESET}" "$inbox"

    # Unread count
    local unread_color="$RESET"
    [[ $unread -gt 0 ]] && unread_color="$BRIGHT_YELLOW"
    move_cursor "$((row+4))" "$col"
    printf "${WHITE}${CARD_V}${RESET} Unread: ${unread_color}%-$((width-11))s${RESET} ${WHITE}${CARD_V}${RESET}" "$unread"

    # Bottom border
    move_cursor "$((row+5))" "$col"
    printf "${WHITE}${CARD_BL}"
    for ((i=0; i<width-2; i++)); do printf "${CARD_H}"; done
    printf "${CARD_BR}${RESET}"
}

# =============================================================================
# JSON PARSING (Pure Bash)
# =============================================================================
# Extract a simple string value from JSON: json_get_string '{"key":"value"}' "key"
json_get_string() {
    local json=$1
    local key=$2
    echo "$json" | grep -oP "\"$key\"\s*:\s*\"[^\"]*\"" | head -1 | sed "s/\"$key\"\s*:\s*\"\([^\"]*\)\"/\1/"
}

# Extract a number value from JSON
json_get_number() {
    local json=$1
    local key=$2
    echo "$json" | grep -oP "\"$key\"\s*:\s*[0-9]+" | head -1 | sed "s/\"$key\"\s*:\s*//"
}

# Extract array length (counts occurrences of a pattern)
json_count_array_items() {
    local json=$1
    local pattern=$2
    echo "$json" | grep -oP "$pattern" | wc -l
}

# Parse email list from inbox response
parse_inbox_emails() {
    local json=$1

    # Extract emails array content - simplified parsing
    # Each email has "id", "from", "to", "subject", "timestamp", "read"
    echo "$json" | tr '\n' ' ' | grep -oP '\{[^{}]*?"id"[^{}]*?\}' | while read -r email; do
        local id=$(json_get_string "$email" "id")
        local from=$(json_get_string "$email" "from")
        local to=$(json_get_string "$email" "to")
        local subject=$(json_get_string "$email" "subject")
        local timestamp=$(json_get_string "$email" "timestamp")
        local is_read=$(echo "$email" | grep -oP '"read"\s*:\s*(true|false)' | grep -oP '(true|false)')

        # Output as tab-separated values
        printf "%s\t%s\t%s\t%s\t%s\t%s\n" "$id" "$from" "$to" "$subject" "$timestamp" "$is_read"
    done
}

# =============================================================================
# API CLIENT
# =============================================================================
API_AVAILABLE=false
LAST_API_CHECK=0

check_api_health() {
    local response
    response=$(curl -s --connect-timeout 2 "${API_BASE}/health" 2>/dev/null)
    if [[ $? -eq 0 && -n "$response" ]]; then
        API_AVAILABLE=true
    else
        API_AVAILABLE=false
    fi
}

fetch_inbox() {
    local viewer=$1
    if [[ "$API_AVAILABLE" != "true" ]]; then
        echo ""
        return 1
    fi

    curl -s --connect-timeout 5 "${API_BASE}/mail?viewer=${viewer}" 2>/dev/null
}

fetch_all_emails() {
    # Use investigation endpoint to get all emails for the activity feed
    local viewer=${1:-mike}
    if [[ "$API_AVAILABLE" != "true" ]]; then
        echo ""
        return 1
    fi

    curl -s --connect-timeout 5 "${API_BASE}/investigation/${viewer}" 2>/dev/null
}

# =============================================================================
# DATA PROCESSING
# =============================================================================
declare -A AGENT_INBOX_COUNT
declare -A AGENT_UNREAD_COUNT
declare -A AGENT_STATUS
declare -a ACTIVITY_FEED

refresh_agent_data() {
    for i in "${!AGENTS[@]}"; do
        local agent="${AGENTS[$i]}"
        local inbox_json
        inbox_json=$(fetch_inbox "$agent")

        if [[ -n "$inbox_json" ]]; then
            # Count total emails in inbox
            local total
            total=$(echo "$inbox_json" | tr '\n' ' ' | grep -oP '"id"\s*:' | wc -l)
            AGENT_INBOX_COUNT[$agent]=$total

            # Count unread emails
            local unread
            unread=$(echo "$inbox_json" | tr '\n' ' ' | grep -oP '"read"\s*:\s*false' | wc -l)
            AGENT_UNREAD_COUNT[$agent]=$unread

            # Determine status from latest email subject
            local latest_subject
            latest_subject=$(echo "$inbox_json" | grep -oP '"subject"\s*:\s*"[^"]*"' | head -1 | sed 's/"subject"\s*:\s*"\([^"]*\)"/\1/')

            if [[ "$latest_subject" =~ ^BLOCKED: || "$latest_subject" =~ ^QUESTION: ]]; then
                AGENT_STATUS[$agent]="blocked"
            elif [[ "$latest_subject" =~ ^PROGRESS: || "$latest_subject" =~ ^COMPLETE: || "$latest_subject" =~ ^GETTING\ STARTED: ]]; then
                AGENT_STATUS[$agent]="active"
            else
                AGENT_STATUS[$agent]="waiting"
            fi
        else
            AGENT_INBOX_COUNT[$agent]=0
            AGENT_UNREAD_COUNT[$agent]=0
            AGENT_STATUS[$agent]="unknown"
        fi
    done
}

refresh_activity_feed() {
    ACTIVITY_FEED=()

    # Fetch inbox for one agent (mike sees most traffic)
    local inbox_json
    inbox_json=$(fetch_inbox "mike")

    if [[ -z "$inbox_json" ]]; then
        return
    fi

    # Split JSON into individual email lines and parse
    local tmpfile="/tmp/agora_emails_$$"
    echo "$inbox_json" | tr '\n' ' ' | tr -s ' ' | sed 's/}, *{/}\n{/g' | grep '"from"' > "$tmpfile"

    while IFS= read -r line; do
        local from=$(echo "$line" | sed 's/.*"from": *"\([^"]*\)".*/\1/')
        local to=$(echo "$line" | sed 's/.*"to": *\[ *"\([^"]*\)".*/\1/')
        local subject=$(echo "$line" | sed 's/.*"subject": *"\([^"]*\)".*/\1/')
        local ts=$(echo "$line" | sed 's/.*"timestamp": *"\([^"]*\)".*/\1/')
        local time_part=$(echo "$ts" | sed 's/.*T\([0-9][0-9]:[0-9][0-9]:[0-9][0-9]\).*/\1/')
        [[ -z "$time_part" || "$time_part" == "$ts" ]] && time_part="--:--:--"

        if [[ -n "$from" && "$from" != "$line" ]]; then
            ACTIVITY_FEED+=("$time_part|$from|$to|$subject")
        fi
    done < "$tmpfile"

    rm -f "$tmpfile"

    # Sort by timestamp descending
    IFS=$'\n' ACTIVITY_FEED=($(printf '%s\n' "${ACTIVITY_FEED[@]}" | sort -r | head -20))
}

# =============================================================================
# ACTIVITY FEED RENDERING
# =============================================================================
get_prefix_color() {
    local subject=$1

    if [[ "$subject" =~ ^APPROVED: || "$subject" =~ ^COMPLETE: ]]; then
        echo "$GREEN"
    elif [[ "$subject" =~ ^PROGRESS: || "$subject" =~ ^ACKNOWLEDGED: ]]; then
        echo "$YELLOW"
    elif [[ "$subject" =~ ^BLOCKED: || "$subject" =~ ^QUESTION: || "$subject" =~ ^REVISION: ]]; then
        echo "$RED"
    elif [[ "$subject" =~ ^GETTING\ STARTED: || "$subject" =~ ^IMPORTANT: ]]; then
        echo "$CYAN"
    elif [[ "$subject" =~ ^COLLABORATION ]]; then
        echo "$MAGENTA"
    else
        echo "$WHITE"
    fi
}

render_activity_feed() {
    local start_row=12
    local col=3
    local max_width=$((TERM_COLS - 6))
    local max_items=$((TERM_ROWS - 16))

    # Header
    draw_text "$((start_row-1))" "$col" "RECENT MAILBOX ACTIVITY" "${BOLD}${WHITE}"

    # Live indicator
    local live_col=$((TERM_COLS - 10))
    draw_text "$((start_row-1))" "$live_col" "[LIVE " "${DIM}"
    printf "${GREEN}${BULLET}${RESET}${DIM}]${RESET}"

    # Separator line
    draw_horizontal_line "$start_row" "$col" "$max_width" "$CARD_H"

    # Activity items
    local row=$((start_row + 1))
    local count=0

    for entry in "${ACTIVITY_FEED[@]}"; do
        if [[ $count -ge $max_items ]]; then
            break
        fi

        IFS='|' read -r time from to subject <<< "$entry"

        local color
        color=$(get_prefix_color "$subject")

        # Truncate subject to fit
        local subject_max=$((max_width - 30))
        subject=$(truncate_text "$subject" "$subject_max")

        move_cursor "$row" "$col"
        printf "${DIM}%s${RESET}  ${BRIGHT_WHITE}%-8s${RESET} ${DIM}→${RESET} ${WHITE}%-8s${RESET}  ${color}%s${RESET}" \
            "$time" "$from" "$to" "$subject"

        ((row++))
        ((count++))
    done

    # Fill remaining rows with empty lines
    while [[ $count -lt $max_items ]]; do
        move_cursor "$row" "$col"
        printf "%-${max_width}s" ""
        ((row++))
        ((count++))
    done
}

# =============================================================================
# AGENTS SECTION RENDERING
# =============================================================================
render_agents_section() {
    draw_text 2 3 "AGENTS" "${BOLD}${WHITE}"

    local card_row=4
    local card_col=4
    local card_spacing=18

    for i in "${!AGENTS[@]}"; do
        local agent="${AGENTS[$i]}"
        local role="${AGENT_ROLES[$i]}"
        local inbox=${AGENT_INBOX_COUNT[$agent]:-0}
        local unread=${AGENT_UNREAD_COUNT[$agent]:-0}
        local status=${AGENT_STATUS[$agent]:-unknown}

        local col=$((card_col + i * card_spacing))
        draw_agent_card "$card_row" "$col" "$agent" "$role" "$inbox" "$unread" "$status"
    done
}

# =============================================================================
# CONTROLS BAR
# =============================================================================
render_controls() {
    local row=$((TERM_ROWS - 1))
    local col=3

    move_cursor "$row" "$col"
    printf "${DIM}[${RESET}${BRIGHT_WHITE}R${RESET}${DIM}] Refresh  "
    printf "[${RESET}${BRIGHT_WHITE}1-3${RESET}${DIM}] View Agent  "
    printf "[${RESET}${BRIGHT_WHITE}Q${RESET}${DIM}] Quit${RESET}"
}

# =============================================================================
# STATUS BAR
# =============================================================================
render_status_bar() {
    local row=$((TERM_ROWS - 1))
    local col=$((TERM_COLS - 30))

    if [[ "$API_AVAILABLE" == "true" ]]; then
        draw_text "$row" "$col" "API: " "$DIM"
        printf "${GREEN}${BULLET} Connected${RESET}"
    else
        draw_text "$row" "$col" "API: " "$DIM"
        printf "${RED}${BULLET} Disconnected${RESET}"
    fi
}

# =============================================================================
# FULL SCREEN RENDER
# =============================================================================
render_screen() {
    clear_screen
    get_terminal_size
    draw_main_frame
    render_agents_section
    render_activity_feed
    render_controls
    render_status_bar
}

# =============================================================================
# AGENT DETAIL VIEW
# =============================================================================
current_view="main"
selected_agent=""

render_agent_detail() {
    local agent=$1
    local idx=-1

    # Find agent index
    for i in "${!AGENTS[@]}"; do
        if [[ "${AGENTS[$i]}" == "$agent" ]]; then
            idx=$i
            break
        fi
    done

    [[ $idx -eq -1 ]] && return

    local role="${AGENT_ROLES[$idx]}"
    local inbox=${AGENT_INBOX_COUNT[$agent]:-0}
    local unread=${AGENT_UNREAD_COUNT[$agent]:-0}
    local status=${AGENT_STATUS[$agent]:-unknown}

    clear_screen
    get_terminal_size

    # Draw frame
    draw_main_frame

    # Title
    draw_text_centered 1 "$TERM_COLS" " AGENT: $(echo "$agent" | tr '[:lower:]' '[:upper:]') " "${BOLD}${BRIGHT_CYAN}"

    # Agent info
    draw_text 3 4 "Role: $role" "$WHITE"
    draw_text 4 4 "Status: $status" "$WHITE"
    draw_text 5 4 "Inbox: $inbox emails ($unread unread)" "$WHITE"

    # Inbox contents
    draw_text 7 4 "INBOX CONTENTS" "${BOLD}${WHITE}"
    draw_horizontal_line 8 4 $((TERM_COLS - 8)) "$CARD_H"

    local inbox_json
    inbox_json=$(fetch_inbox "$agent")

    local row=9
    local max_rows=$((TERM_ROWS - 13))
    local count=0

    if [[ -n "$inbox_json" ]]; then
        while IFS= read -r email; do
            if [[ $count -ge $max_rows ]]; then
                break
            fi

            local from=$(json_get_string "$email" "from")
            local subject=$(json_get_string "$email" "subject")
            local is_read=$(echo "$email" | grep -oP '"read"\s*:\s*(true|false)' | grep -oP '(true|false)')

            local color
            color=$(get_prefix_color "$subject")

            local read_indicator=""
            [[ "$is_read" == "false" ]] && read_indicator="${BRIGHT_YELLOW}*${RESET}"

            subject=$(truncate_text "$subject" $((TERM_COLS - 25)))

            move_cursor "$row" 4
            printf "%s ${DIM}from${RESET} ${WHITE}%-10s${RESET} ${color}%s${RESET}" \
                "$read_indicator" "$from" "$subject"

            ((row++))
            ((count++))
        done < <(echo "$inbox_json" | tr '\n' ' ' | grep -oP '\{[^{}]*?"id"[^{}]*?\}')
    fi

    if [[ $count -eq 0 ]]; then
        draw_text 9 4 "(No emails in inbox)" "$DIM"
    fi

    # Controls
    local ctrl_row=$((TERM_ROWS - 1))
    move_cursor "$ctrl_row" 3
    printf "${DIM}[${RESET}${BRIGHT_WHITE}B${RESET}${DIM}] Back  "
    printf "[${RESET}${BRIGHT_WHITE}R${RESET}${DIM}] Refresh  "
    printf "[${RESET}${BRIGHT_WHITE}Q${RESET}${DIM}] Quit${RESET}"

    render_status_bar
}

# =============================================================================
# INPUT HANDLING
# =============================================================================
handle_input() {
    local key
    read -t 0.1 -n 1 key 2>/dev/null

    case "$key" in
        q|Q)
            return 1
            ;;
        r|R)
            check_api_health
            refresh_agent_data
            refresh_activity_feed
            if [[ "$current_view" == "main" ]]; then
                render_screen
            else
                render_agent_detail "$selected_agent"
            fi
            ;;
        1)
            if [[ "$current_view" == "main" ]]; then
                current_view="detail"
                selected_agent="mike"
                render_agent_detail "$selected_agent"
            fi
            ;;
        2)
            if [[ "$current_view" == "main" ]]; then
                current_view="detail"
                selected_agent="jamie"
                render_agent_detail "$selected_agent"
            fi
            ;;
        3)
            if [[ "$current_view" == "main" ]]; then
                current_view="detail"
                selected_agent="justin"
                render_agent_detail "$selected_agent"
            fi
            ;;
        b|B)
            if [[ "$current_view" == "detail" ]]; then
                current_view="main"
                render_screen
            fi
            ;;
    esac

    return 0
}

# =============================================================================
# CLEANUP
# =============================================================================
cleanup() {
    show_cursor
    clear_screen
    move_cursor 1 1
    printf "${RESET}"
    echo "AGORA Dashboard closed."
    exit 0
}

# =============================================================================
# MAIN
# =============================================================================
main() {
    # Setup
    trap cleanup EXIT INT TERM
    hide_cursor

    # Initial data fetch
    check_api_health
    refresh_agent_data
    refresh_activity_feed

    # Initial render
    render_screen

    # Main loop
    local last_refresh=$(date +%s)

    while true; do
        # Handle input
        if ! handle_input; then
            break
        fi

        # Auto-refresh every REFRESH_INTERVAL seconds
        local now=$(date +%s)
        if (( now - last_refresh >= REFRESH_INTERVAL )); then
            check_api_health
            refresh_agent_data
            refresh_activity_feed

            if [[ "$current_view" == "main" ]]; then
                render_screen
            else
                render_agent_detail "$selected_agent"
            fi

            last_refresh=$now
        fi

        # Small sleep to prevent CPU spinning
        sleep 0.05
    done
}

# Run
main "$@"
