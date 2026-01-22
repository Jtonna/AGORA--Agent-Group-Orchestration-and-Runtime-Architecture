# Implement Quarantine Logic

**Type:** task
**Status:** open
**Epic:** agora-6 (Phase 1 - Storage Layer)
**Priority:** high
**Assignee:** Employee

## Description

Implement quarantine file handling for invalid emails that cannot be auto-fixed.

## Quarantine File Structure

`data/quarantine.json`:
```json
{
  "version": 1,
  "quarantined": [
    {
      "original": { /* invalid email data */ },
      "reason": "missing required field: subject",
      "quarantined_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

## Quarantine File Validation

On startup:
1. If doesn't exist → create with `{"version": 1, "quarantined": []}`
2. If invalid JSON/structure/version → rename to `quarantine.json.bak.<timestamp>`, create fresh

## Methods to Implement

```python
def quarantine_email(self, original_data: dict, reason: str):
    """Move invalid email to quarantine file"""

def _load_quarantine(self) -> List[dict]:
    """Load quarantine file"""

def _save_quarantine(self, quarantined: List[dict]):
    """Save quarantine file"""
```

## Timestamp Format

`quarantine.json.bak.2024-01-15T10-30-00Z`
- Use hyphens instead of colons for Windows compatibility

## Acceptance Criteria

- [ ] Quarantine file created if missing
- [ ] Invalid quarantine file backed up and recreated
- [ ] Quarantine entries include original data, reason, timestamp
- [ ] Multiple emails can be quarantined
- [ ] Backup filename is filesystem-safe

## Dependencies

- **Blocked by:** agora-8 (quarantine is called from validation)

---
**Created:** 2026-01-22
