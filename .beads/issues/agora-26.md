# Integration Tests for Pagination

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** high
**Assignee:** Employee

## Description

Create integration tests specifically for pagination behavior across all paginated endpoints.

## Test File

`tests/integration/test_pagination.py`

## Test Cases

### GET /mail Pagination (10 per page)
- [ ] Page 1 returns first 10
- [ ] Page 2 returns next 10
- [ ] Last page returns remaining
- [ ] Page 0 returns error
- [ ] Negative page returns error
- [ ] Non-numeric page returns error
- [ ] Page exceeding total returns error
- [ ] Empty inbox returns page 1

### GET /mail/{id} Thread Pagination (20 per page)
- [ ] Page 1 returns first 20 thread emails
- [ ] Page 2 returns next 20
- [ ] Empty thread returns empty array with page 1
- [ ] Invalid thread_page returns error

### GET /investigation Pagination (20 per page)
- [ ] Page 1 returns first 20
- [ ] Page 2 returns next 20
- [ ] Empty results return page 1
- [ ] Invalid page returns error

### Pagination Metadata
- [ ] total_items is accurate
- [ ] total_pages calculation correct
- [ ] has_next true when more pages
- [ ] has_next false on last page
- [ ] has_prev false on page 1
- [ ] has_prev true on page 2+
- [ ] per_page matches endpoint (10 or 20)

## Test Data Setup

Create fixtures with enough emails to test:
- 25+ emails for inbox (3 pages)
- 50+ thread emails (3 pages)
- Various viewer participation

## Acceptance Criteria

- [ ] All pagination scenarios tested
- [ ] All paginated endpoints covered
- [ ] Edge cases verified
- [ ] `pipenv run pytest tests/integration/test_pagination.py` passes

## Dependencies

- **Blocked by:** agora-25 (basic endpoint tests first)

---
**Created:** 2026-01-22
