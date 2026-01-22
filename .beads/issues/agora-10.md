# Unit Tests for Storage

**Type:** task
**Status:** open
**Epic:** agora-6 (Phase 1 - Storage Layer)
**Priority:** high
**Assignee:** Employee

## Description

Create comprehensive unit tests for `storage.py` covering all storage operations and validation logic.

## Test File

`tests/unit/test_storage.py`

## Test Cases

### File Operations
- [ ] Creates data directory if missing
- [ ] Creates emails.json if missing
- [ ] Creates quarantine.json if missing
- [ ] Reads existing valid file
- [ ] Refuses to start on invalid JSON
- [ ] Handles version migration

### Singleton Pattern
- [ ] Only one instance created
- [ ] Subsequent calls return same instance
- [ ] State persists across calls

### CRUD Operations
- [ ] Get all emails returns list
- [ ] Get email by ID returns correct email
- [ ] Get email by ID returns None for missing
- [ ] Create email adds to storage
- [ ] Create email writes to file
- [ ] Update email modifies correct fields
- [ ] Update email writes to file

### Startup Validation
- [ ] Normalizes names to lowercase
- [ ] Trims whitespace
- [ ] Defaults missing readBy/deletedBy to []
- [ ] Filters non-string elements from arrays
- [ ] Deduplicates arrays
- [ ] Converts version "1" to 1
- [ ] Strips extra fields

### Quarantine
- [ ] Quarantines missing required fields
- [ ] Quarantines wrong field types
- [ ] Quarantines invalid UUIDs
- [ ] Quarantines invalid timestamps
- [ ] Quarantines duplicate IDs
- [ ] Quarantine entry has correct structure
- [ ] Backs up invalid quarantine file

### Thread Safety (basic)
- [ ] Concurrent reads don't crash
- [ ] Concurrent writes don't corrupt

## Test Fixtures

Use pytest fixtures for:
- Temporary directory for test files
- Sample valid emails
- Sample invalid emails

## Acceptance Criteria

- [ ] All test cases implemented
- [ ] Tests use temp directories (no pollution)
- [ ] Tests run with `pipenv run pytest tests/unit/test_storage.py`
- [ ] 100% pass rate

## Dependencies

- **Blocked by:** agora-9 (needs complete storage module)

---
**Created:** 2026-01-22
