# Unit Tests for Services

**Type:** task
**Status:** open
**Epic:** agora-11 (Phase 2 - Services Layer)
**Priority:** high
**Assignee:** Employee

## Description

Create comprehensive unit tests for `services.py` covering all business logic.

## Test File

`tests/unit/test_services.py`

## Test Cases

### Inbox Filtering Tests
- [ ] Returns only emails where viewer is recipient
- [ ] Returns only emails where viewer is sender
- [ ] Returns emails where viewer is both sender and recipient
- [ ] Excludes deleted emails
- [ ] Case-insensitive viewer matching
- [ ] Sorted by timestamp descending
- [ ] Pagination returns correct slice
- [ ] Empty inbox returns empty data with page 1

### Thread Building Tests
- [ ] Single email (no replies) has empty thread
- [ ] Direct reply appears in thread
- [ ] Deep reply chain (3+ levels) builds correctly
- [ ] Multiple replies to same parent all appear
- [ ] Root is correctly identified
- [ ] Excludes requested email from thread
- [ ] Cycle detection stops infinite loop
- [ ] Orphan reference (parent missing) treats email as root
- [ ] Thread includes deleted emails
- [ ] Sorted by timestamp descending
- [ ] Pagination works correctly

### Pagination Tests
- [ ] Page 1 returns first N items
- [ ] Page 2 returns correct offset
- [ ] Last page returns remaining items
- [ ] Empty list returns page 1 with empty data
- [ ] total_pages calculation correct
- [ ] has_next correct on last page
- [ ] has_prev correct on first page
- [ ] Invalid page (0, negative, non-numeric) raises error
- [ ] Page exceeding total raises error

### Read/Delete Status Tests
- [ ] mark_as_read adds to readBy
- [ ] mark_as_read is case-insensitive
- [ ] mark_as_read doesn't duplicate
- [ ] mark_as_deleted adds to deletedBy
- [ ] mark_as_deleted is case-insensitive
- [ ] mark_as_deleted doesn't duplicate
- [ ] is_read_by returns true when read
- [ ] is_read_by returns false when not read
- [ ] is_read_by is case-insensitive

## Test Fixtures

Create fixtures for:
- Sample emails with various states
- Email chains (parent → child → grandchild)
- Emails with various read/delete states
- Mock storage for isolation

## Acceptance Criteria

- [ ] All test cases implemented
- [ ] Tests run with `pipenv run pytest tests/unit/test_services.py`
- [ ] 100% pass rate
- [ ] Tests are isolated (no shared state)

## Dependencies

- **Blocked by:** agora-15 (needs complete services module)

---
**Created:** 2026-01-22
