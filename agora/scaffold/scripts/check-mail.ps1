# Check inbox and display emails in compact format
# Usage: .\check-mail.ps1 <agent-name> [-UnreadOnly] [-Poll [-Interval <seconds>] [-MaxRuntime <minutes>]]

param(
    [Parameter(Mandatory=$true, Position=0)]
    [string]$Agent,

    [switch]$UnreadOnly,
    [switch]$Poll,
    [int]$Interval = 15,
    [int]$MaxRuntime = 7  # minutes
)

# Read port from config
$ConfigFile = Join-Path (Split-Path $PSScriptRoot) "config.json"
if (Test-Path $ConfigFile) {
  $config = Get-Content $ConfigFile | ConvertFrom-Json
  $Port = if ($config.port) { $config.port } else { 60061 }
} else {
  $Port = 60061
}
$BaseUrl = "http://localhost:$Port"

function Get-UnreadIds {
    $response = Invoke-RestMethod "$BaseUrl/mail?viewer=$Agent"
    return $response.data | Where-Object { -not $_.read } | ForEach-Object { $_.id } | Sort-Object
}

function Format-Email($email) {
    $status = if ($email.read) { "READ" } else { "UNREAD" }
    "ID: $($email.id) | FROM: $($email.from) | SUBJECT: $($email.subject) | $status"
}

function Print-Emails($response) {
    foreach ($email in $response.data) {
        if ($UnreadOnly -and $email.read) { continue }
        Format-Email $email
    }
}

function Print-NewEmails($newIds) {
    $response = Invoke-RestMethod "$BaseUrl/mail?viewer=$Agent"
    foreach ($email in $response.data) {
        if ($newIds -contains $email.id) {
            Format-Email $email
        }
    }
}

try {
    # Non-polling mode: just print and exit
    if (-not $Poll) {
        $response = Invoke-RestMethod "$BaseUrl/mail?viewer=$Agent"
        Print-Emails $response
        exit 0
    }

    # Polling mode
    Write-Host "Polling for new mail (interval: ${Interval}s, max runtime: $MaxRuntime minutes)..."

    # Check for existing unread emails FIRST
    $initialIds = @(Get-UnreadIds)
    if ($initialIds.Count -gt 0) {
        Write-Host "UNREAD MAIL:"
        Print-NewEmails $initialIds
        exit 0
    }

    # No existing unread mail - poll for new arrivals
    $startTime = Get-Date
    $maxSeconds = $MaxRuntime * 60

    while ($true) {
        Start-Sleep -Seconds $Interval

        # Check elapsed time
        $elapsed = (Get-Date) - $startTime

        if ($elapsed.TotalSeconds -ge $maxSeconds) {
            Write-Host "No new emails in $MaxRuntime minutes, please restart to continue watching"
            exit 1
        }

        # Get current unread IDs
        $currentIds = @(Get-UnreadIds)

        # Find new IDs (in current but not in initial)
        $newIds = $currentIds | Where-Object { $_ -notin $initialIds }

        if ($newIds.Count -gt 0) {
            Write-Host "NEW MAIL DETECTED:"
            Print-NewEmails $newIds
            exit 0
        }
    }

} catch {
    Write-Error "Failed to check mail: $_"
    exit 1
}
