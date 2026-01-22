# Unit Tests for Models

**Type:** task
**Status:** open
**Epic:** agora-1 (Phase 0 - Foundation)
**Priority:** high
**Assignee:** Employee

## Description

Create comprehensive unit tests for `models.py` covering all validation logic.

## Test File

`tests/unit/test_models.py`

## Test Cases

### Name Normalization Tests
- [ ] Converts uppercase to lowercase
- [ ] Trims leading/trailing whitespace
- [ ] Handles mixed case
- [ ] Rejects empty string
- [ ] Rejects whitespace-only string
- [ ] Handles names with spaces (keeps internal spaces)

### UUID Validation Tests
- [ ] Accepts valid UUID
- [ ] Rejects invalid format
- [ ] Rejects empty string
- [ ] Rejects non-string types
- [ ] Handles None correctly

### Email Validation Tests (for create)
- [ ] Valid email passes all checks
- [ ] Missing `to` field rejected
- [ ] Empty `to` array rejected
- [ ] Non-array `to` rejected
- [ ] Non-string element in `to` rejected
- [ ] Whitespace-only name in `to` rejected
- [ ] Missing `from` rejected
- [ ] Empty `from` rejected
- [ ] Missing `subject` rejected
- [ ] Empty `subject` rejected
- [ ] Missing `content` rejected
- [ ] Empty `content` rejected
- [ ] Invalid `isResponseTo` UUID rejected
- [ ] Null `isResponseTo` accepted
- [ ] Empty string `isResponseTo` treated as null
- [ ] Unknown fields rejected

### Deduplication Tests
- [ ] Removes duplicate names
- [ ] Preserves order
- [ ] Case-insensitive deduplication
- [ ] Handles empty list
- [ ] Handles single item

## Acceptance Criteria

- [ ] All test cases implemented
- [ ] Tests run with `pipenv run pytest tests/unit/test_models.py`
- [ ] 100% pass rate

## Dependencies

- **Blocked by:** agora-4 (needs models to test)

---
**Created:** 2026-01-22
