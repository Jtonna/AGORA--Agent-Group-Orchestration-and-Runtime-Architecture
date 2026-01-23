# Send email via the corporation's email API
# Usage: .\send-mail.ps1 -From "jamie" -To "mike" -Subject "COMPLETE: Task" -Content "Message body" [-ReplyTo "uuid"]
# Note: For multiple recipients, use comma-separated: -To "mike,justin" or -To "mike","justin"

param(
    [Parameter(Mandatory=$true)]
    [string]$From,

    [Parameter(Mandatory=$true)]
    [string[]]$To,

    [Parameter(Mandatory=$true)]
    [string]$Subject,

    [Parameter(Mandatory=$true)]
    [string]$Content,

    [string]$ReplyTo = $null
)

$BaseUrl = "http://localhost:60061"

try {
    # Handle comma-separated recipients (split each element on comma, then flatten)
    $recipients = @($To | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim().ToLower() } | Where-Object { $_ -ne '' })

    $body = @{
        from = $From.ToLower()
        to = $recipients
        subject = $Subject
        content = $Content
    }

    if ($ReplyTo) {
        $body.isResponseTo = $ReplyTo
    } else {
        $body.isResponseTo = $null
    }

    $json = $body | ConvertTo-Json -Compress

    $response = Invoke-RestMethod -Uri "$BaseUrl/mail" -Method Post -Body $json -ContentType "application/json; charset=utf-8"

    Write-Host "Email sent: $($response.id)"
    exit 0

} catch {
    Write-Error "Error: $_"
    exit 1
}
