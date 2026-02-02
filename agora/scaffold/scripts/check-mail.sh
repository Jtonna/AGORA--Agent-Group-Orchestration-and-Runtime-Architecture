#!/bin/bash
# Check inbox and display emails in compact format
# Usage: ./check-mail.sh <agent-name> [--unread-only] [--poll [--interval <seconds>] [--max-runtime <minutes>]]

set -e

# Read port from config
CONFIG_FILE="$(dirname "$0")/../config.json"
if [ -f "$CONFIG_FILE" ] && command -v jq &>/dev/null; then
  PORT=$(jq -r '.port // 60061' "$CONFIG_FILE")
else
  PORT=60061
fi
BASE_URL="http://localhost:$PORT"

# Parse arguments
AGENT=""
UNREAD_ONLY=false
POLL_MODE=false
INTERVAL=15
MAX_RUNTIME=7  # minutes

while [[ $# -gt 0 ]]; do
    case $1 in
        --unread-only)
            UNREAD_ONLY=true
            shift
            ;;
        --poll)
            POLL_MODE=true
            shift
            ;;
        --interval)
            INTERVAL=$2
            shift 2
            ;;
        --max-runtime)
            MAX_RUNTIME=$2
            shift 2
            ;;
        *)
            if [ -z "$AGENT" ]; then
                AGENT=$1
            fi
            shift
            ;;
    esac
done

if [ -z "$AGENT" ]; then
    echo "Usage: ./check-mail.sh <agent-name> [--unread-only] [--poll [--interval <seconds>] [--max-runtime <minutes>]]"
    exit 1
fi

# Function to get unread email IDs
get_unread_ids() {
    curl -s "$BASE_URL/mail?viewer=$AGENT" | jq -r '.data[] | select(.read == false) | .id' | sort
}

# Function to format and print emails
print_emails() {
    local response=$1
    if [ "$UNREAD_ONLY" = true ]; then
        echo "$response" | jq -r '.data[] | select(.read == false) |
            "ID: \(.id) | FROM: \(.from) | SUBJECT: \(.subject) | UNREAD"'
    else
        echo "$response" | jq -r '.data[] |
            "ID: \(.id) | FROM: \(.from) | SUBJECT: \(.subject) | \(if .read then "READ" else "UNREAD" end)"'
    fi
}

# Function to print only new emails
print_new_emails() {
    local new_ids=$1
    local response=$(curl -s "$BASE_URL/mail?viewer=$AGENT")

    for id in $new_ids; do
        echo "$response" | jq -r --arg id "$id" '.data[] | select(.id == $id) |
            "ID: \(.id) | FROM: \(.from) | SUBJECT: \(.subject) | UNREAD"'
    done
}

# Non-polling mode: just print and exit
if [ "$POLL_MODE" = false ]; then
    response=$(curl -s "$BASE_URL/mail?viewer=$AGENT")
    print_emails "$response"
    exit 0
fi

# Polling mode
echo "Polling for new mail (interval: ${INTERVAL}s, max runtime: ${MAX_RUNTIME} minutes)..."

# Check for existing unread emails FIRST
initial_ids=$(get_unread_ids)
if [ -n "$initial_ids" ]; then
    echo "UNREAD MAIL:"
    print_new_emails "$initial_ids"
    exit 0
fi

# No existing unread mail - poll for new arrivals
start_time=$(date +%s)
max_seconds=$((MAX_RUNTIME * 60))

while true; do
    sleep $INTERVAL

    # Check elapsed time
    current_time=$(date +%s)
    elapsed=$((current_time - start_time))

    if [ $elapsed -ge $max_seconds ]; then
        echo "No new emails in $MAX_RUNTIME minutes, please restart to continue watching"
        exit 1
    fi

    # Get current unread IDs
    current_ids=$(get_unread_ids)

    # Find new IDs (in current but not in initial)
    new_ids=$(comm -23 <(echo "$current_ids") <(echo "$initial_ids"))

    if [ -n "$new_ids" ]; then
        echo "NEW MAIL DETECTED:"
        print_new_emails "$new_ids"
        exit 0
    fi
done
