#!/bin/bash
# Send email via the corporation's email API
# Usage: ./send-mail.sh --from jamie --to mike --subject "COMPLETE: Task" --content "Message body" [--reply-to uuid]
# Note: For multiple recipients, use comma-separated: --to mike,justin

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
FROM=""
TO=""
SUBJECT=""
CONTENT=""
REPLY_TO=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --from)
            FROM="$2"
            shift 2
            ;;
        --to)
            TO="$2"
            shift 2
            ;;
        --subject)
            SUBJECT="$2"
            shift 2
            ;;
        --content)
            CONTENT="$2"
            shift 2
            ;;
        --reply-to)
            REPLY_TO="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$FROM" ] || [ -z "$TO" ] || [ -z "$SUBJECT" ] || [ -z "$CONTENT" ]; then
    echo "Usage: ./send-mail.sh --from <sender> --to <recipient(s)> --subject <subject> --content <body> [--reply-to <uuid>]"
    echo "  --to accepts comma-separated values for multiple recipients"
    exit 1
fi

# Convert TO to JSON array (handle comma-separated)
TO_ARRAY=$(echo "$TO" | tr ',' '\n' | tr '[:upper:]' '[:lower:]' | jq -R . | jq -s .)

# Build JSON payload
if [ -n "$REPLY_TO" ]; then
    JSON=$(jq -n \
        --arg from "$(echo "$FROM" | tr '[:upper:]' '[:lower:]')" \
        --argjson to "$TO_ARRAY" \
        --arg subject "$SUBJECT" \
        --arg content "$CONTENT" \
        --arg replyTo "$REPLY_TO" \
        '{from: $from, to: $to, subject: $subject, content: $content, isResponseTo: $replyTo}')
else
    JSON=$(jq -n \
        --arg from "$(echo "$FROM" | tr '[:upper:]' '[:lower:]')" \
        --argjson to "$TO_ARRAY" \
        --arg subject "$SUBJECT" \
        --arg content "$CONTENT" \
        '{from: $from, to: $to, subject: $subject, content: $content, isResponseTo: null}')
fi

# Send request
response=$(curl -s -X POST "$BASE_URL/mail" \
    -H "Content-Type: application/json; charset=utf-8" \
    -d "$JSON")

# Extract ID from response
id=$(echo "$response" | jq -r '.id // empty')

if [ -n "$id" ]; then
    echo "Email sent: $id"
    exit 0
else
    error=$(echo "$response" | jq -r '.error // "Unknown error"')
    echo "Error: $error"
    exit 1
fi
