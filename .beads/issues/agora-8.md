# Implement Startup Validation

**Type:** task
**Status:** open
**Epic:** agora-6 (Phase 1 - Storage Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement startup validation logic that validates all emails on load, auto-fixes recoverable issues, and quarantines unrecoverable ones.

## Validation Flow

1. **If emails.json doesn't exist**: Create with `{"version": 1, "emails": []}`
2. **If emails.json is invalid JSON**: Log error, refuse to start
3. **If version unsupported**: Rename to `emails.json.old.<timestamp>`, create fresh
4. **For each email**: Validate and either fix or quarantine

## Recoverable Issues (Auto-Fix)

- Missing `emails` key → default to `[]`
- Names not lowercase → normalize
- Strings with extra whitespace → trim
- Missing `readBy` or `deletedBy` → default to `[]`
- Non-string elements in `readBy`/`deletedBy` → filter out
- Duplicate names in arrays → dedupe
- Version string `"1"` → convert to integer
- Extra fields → strip silently

## Unrecoverable Issues (Quarantine)

- Missing required fields (`id`, `to`, `from`, `subject`, `content`, `timestamp`)
- Wrong field types
- Invalid UUID format
- Invalid timestamp format
- Duplicate `id` values (all with that ID quarantined)

## Logging

Log all actions:
- `[INFO] Created emails.json with empty array`
- `[INFO] Auto-fixed: normalized name 'ALICE' to 'alice' in email {id}`
- `[INFO] Quarantined email {id}: missing required field 'subject'`
- `[ERROR] emails.json is not valid JSON - manual intervention required`

## Acceptance Criteria

- [ ] Missing file creates valid empty structure
- [ ] Invalid JSON prevents startup
- [ ] All recoverable issues auto-fixed
- [ ] All unrecoverable issues quarantined
- [ ] Logging for all actions
- [ ] Duplicate IDs detected and quarantined

## Dependencies

- **Blocked by:** agora-7 (needs storage singleton)

---
**Created:** 2026-01-22
