# Create Email Model

**Type:** task
**Status:** open
**Epic:** agora-1 (Phase 0 - Foundation)
**Priority:** critical
**Assignee:** Employee

## Description

Create `models.py` with the Email dataclass and all validation functions.

## Email Model Fields

```python
@dataclass
class Email:
    id: str                    # UUID
    to: List[str]              # Recipients (lowercase)
    from_: str                 # Sender (lowercase) - note: 'from' is reserved
    subject: str               # Subject line
    content: str               # Body text
    timestamp: str             # ISO 8601 UTC
    isResponseTo: Optional[str]  # Parent email UUID or None
    readBy: List[str]          # Users who read this
    deletedBy: List[str]       # Users who deleted this
```

## Validation Functions

### Name Normalization
- Convert to lowercase
- Trim whitespace
- Reject empty/whitespace-only

### Field Validation
- `to`: Must be non-empty array of non-empty strings
- `from`: Must be non-empty string
- `subject`: Must be non-empty string
- `content`: Must be non-empty string
- `isResponseTo`: Must be valid UUID or null/None
- `id`: Must be valid UUID
- `timestamp`: Must be valid ISO 8601

### UUID Validation
- Use regex or uuid module to validate format
- Accept standard UUID format: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx

### Deduplication
- Remove duplicate names from `to` array
- Preserve order (first occurrence wins)

## Acceptance Criteria

- [ ] Email dataclass with all fields
- [ ] `normalize_name(name)` - lowercase, trim, validate non-empty
- [ ] `validate_email_for_create(data)` - validate POST request body
- [ ] `validate_uuid(value)` - check UUID format
- [ ] `dedupe_list(items)` - remove duplicates preserving order
- [ ] Type validation for all fields

## Dependencies

- **Blocked by:** agora-3 (needs error codes for validation errors)

---
**Created:** 2026-01-22
