# Implement Thread Building Service

**Type:** task
**Status:** open
**Epic:** agora-11 (Phase 2 - Services Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement thread building logic for email conversations with cycle detection.

## Functions to Implement

### `get_thread(email_id: str, exclude_id: str = None, page: int = 1) -> dict`

Builds the complete thread for an email.

**Algorithm:**
1. Find root email by following `isResponseTo` chain upward
   - Use visited set to detect cycles
   - Use iteration (not recursion) to avoid stack overflow
2. Find all descendants by scanning for emails with `isResponseTo` pointing to any thread email
3. Exclude the requested email (it's returned separately)
4. Sort by timestamp descending
5. Paginate (20 per page)

**Return Format:**
```python
{
    "thread": [
        {
            "id": "uuid",
            "from": "sender",
            "to": ["recipient"],
            "subject": "Subject",
            "timestamp": "...",
            "isResponseTo": "parent-id"
        }
    ],
    "thread_pagination": {
        "page": 1,
        "per_page": 20,
        "total_in_thread": 45,
        "total_pages": 3,
        "has_next": True,
        "has_prev": False
    }
}
```

### `find_thread_root(email_id: str) -> str`

Follow `isResponseTo` chain to find root. Returns the root ID.
Handles cycles by stopping if visiting same ID twice.

### `find_thread_descendants(root_id: str) -> List[str]`

Find all email IDs that are part of this thread (descendants of root).

## Thread Building Pseudocode

```python
def build_thread(email_id):
    # Find root
    visited = set()
    current = email_id
    while True:
        if current in visited:
            break  # Cycle detected
        visited.add(current)
        email = storage.get_email_by_id(current)
        if not email or not email.isResponseTo:
            break
        parent = storage.get_email_by_id(email.isResponseTo)
        if not parent:
            break  # Orphan reference
        current = parent.id
    root_id = current

    # Find all thread members
    thread_ids = {root_id}
    changed = True
    while changed:
        changed = False
        for email in storage.get_all_emails():
            if email.isResponseTo in thread_ids and email.id not in thread_ids:
                thread_ids.add(email.id)
                changed = True

    return thread_ids
```

## Acceptance Criteria

- [ ] Finds root correctly
- [ ] Finds all descendants
- [ ] Handles orphan references (parent not found)
- [ ] Detects and handles cycles
- [ ] Uses iteration not recursion
- [ ] Excludes deleted emails? NO - includes ALL
- [ ] Excludes requested email from thread list
- [ ] Sorted newest first
- [ ] Pagination works correctly

## Dependencies

- **Blocked by:** agora-12 (service module structure)

---
**Created:** 2026-01-22
