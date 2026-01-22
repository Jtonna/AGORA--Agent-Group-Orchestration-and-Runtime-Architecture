# Implement Inbox Filtering Service

**Type:** task
**Status:** open
**Epic:** agora-11 (Phase 2 - Services Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement service functions for filtering emails for a user's inbox view.

## Functions to Implement

### `get_inbox(viewer: str, page: int = 1) -> dict`

Returns paginated inbox for a viewer.

**Filtering Logic:**
1. Include emails where `viewer` is in `to` array (case-insensitive)
2. Include emails where `viewer` matches `from` (case-insensitive)
3. Exclude emails where `viewer` is in `deletedBy` array (case-insensitive)

**Sorting:** By timestamp descending (most recent first)

**Pagination:** 10 items per page

**Return Format:**
```python
{
    "data": [
        {
            "id": "uuid",
            "from": "sender",
            "to": ["recipient"],
            "subject": "Subject",
            "timestamp": "2024-01-15T10:30:00Z",
            "isResponseTo": null,
            "read": False  # True if viewer in readBy
        }
    ],
    "pagination": {
        "page": 1,
        "per_page": 10,
        "total_items": 47,
        "total_pages": 5,
        "has_next": True,
        "has_prev": False
    }
}
```

### `is_participant(email: Email, name: str) -> bool`

Check if name is sender or recipient.

### `is_deleted_for(email: Email, viewer: str) -> bool`

Check if viewer has deleted this email.

## Acceptance Criteria

- [ ] Filters by sender/recipient correctly
- [ ] Excludes deleted emails
- [ ] Case-insensitive matching
- [ ] Sorted newest first
- [ ] Pagination works correctly
- [ ] `read` field calculated per viewer

## Dependencies

- **Blocked by:** agora-10 (needs storage layer complete)

---
**Created:** 2026-01-22
