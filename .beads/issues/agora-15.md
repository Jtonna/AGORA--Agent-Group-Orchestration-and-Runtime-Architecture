# Implement Read/Delete Status Management

**Type:** task
**Status:** open
**Epic:** agora-11 (Phase 2 - Services Layer)
**Priority:** high
**Assignee:** Employee

## Description

Implement service functions for managing read and delete status on emails.

## Functions to Implement

### `mark_as_read(email_id: str, viewer: str) -> bool`

Mark email as read for viewer.

```python
def mark_as_read(email_id: str, viewer: str) -> bool:
    """
    Add viewer to email's readBy array.

    - Normalizes viewer to lowercase
    - Dedupes (no duplicate entries)
    - Persists to storage

    Returns True if successful, False if email not found.
    """
```

### `mark_as_deleted(email_id: str, viewer: str) -> bool`

Mark email as deleted for viewer.

```python
def mark_as_deleted(email_id: str, viewer: str) -> bool:
    """
    Add viewer to email's deletedBy array.

    - Normalizes viewer to lowercase
    - Dedupes (no duplicate entries)
    - Persists to storage
    - Idempotent (deleting twice is OK)

    Returns True if successful, False if email not found.
    """
```

### `is_read_by(email: Email, viewer: str) -> bool`

Check if viewer has read the email.

```python
def is_read_by(email: Email, viewer: str) -> bool:
    """
    Check if viewer is in readBy array.
    Case-insensitive comparison.
    """
```

### `get_read_status(email: Email, viewer: str) -> bool`

Same as `is_read_by` - alias for clarity in responses.

## Behavior Notes

- All operations are case-insensitive
- All operations are idempotent
- All operations persist immediately
- No error if already read/deleted

## Acceptance Criteria

- [ ] mark_as_read adds to readBy
- [ ] mark_as_read is idempotent (no duplicates)
- [ ] mark_as_deleted adds to deletedBy
- [ ] mark_as_deleted is idempotent
- [ ] is_read_by returns correct boolean
- [ ] All operations are case-insensitive
- [ ] Changes persist to storage

## Dependencies

- **Blocked by:** agora-13 (service module structure)

---
**Created:** 2026-01-22
