# Create Storage Singleton

**Type:** task
**Status:** open
**Epic:** agora-6 (Phase 1 - Storage Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Create `storage.py` with a singleton storage class that manages all JSON file operations with queued access.

## Architecture

```python
class EmailStorage:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._emails = []
        self._lock = threading.Lock()  # Or use queue
```

## Required Methods

### CRUD Operations
- `get_all_emails()` - Return all emails
- `get_email_by_id(email_id)` - Return single email or None
- `create_email(email)` - Add email, write to file
- `update_email(email_id, updates)` - Update fields, write to file
- `delete_email(email_id)` - Remove email (not used in this spec, but for completeness)

### Query Operations
- `get_emails_for_viewer(viewer)` - Filter by participation
- `get_emails_by_participant(name)` - For investigation endpoint
- `email_exists(email_id)` - Check existence

### File Operations
- `_load_from_file()` - Read and parse JSON
- `_save_to_file()` - Write full file
- `_ensure_data_dir()` - Create data/ if missing

## File Paths
- `data/emails.json` - Main storage
- `data/quarantine.json` - Invalid emails

## JSON Structure
```json
{
  "version": 1,
  "emails": [...]
}
```

## Acceptance Criteria

- [ ] Singleton pattern works correctly
- [ ] Thread-safe access with locking
- [ ] Creates data directory if missing
- [ ] Reads existing file on init
- [ ] Creates empty file if missing
- [ ] All CRUD operations work
- [ ] File is written after each modification

## Dependencies

- **Blocked by:** agora-4 (needs Email model)

---
**Created:** 2026-01-22
