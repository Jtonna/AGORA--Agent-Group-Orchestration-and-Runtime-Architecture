# Create Error Module

**Type:** task
**Status:** open
**Epic:** agora-1 (Phase 0 - Foundation)
**Priority:** critical
**Assignee:** Employee

## Description

Create `errors.py` with all error codes and helper functions for generating standardized error responses.

## Error Codes to Implement

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `EMAIL_NOT_FOUND` | 404 | Email ID does not exist |
| `EMAIL_DELETED` | 404 | Email was deleted by this viewer |
| `NOT_PARTICIPANT` | 403 | Viewer is not a participant |
| `PARENT_NOT_FOUND` | 400 | isResponseTo references non-existent email |
| `MISSING_FIELD` | 400 | Required field not provided |
| `INVALID_FIELD` | 400 | Field value is invalid |
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `INVALID_UUID` | 400 | mail_id is not a valid UUID format |
| `INVALID_PAGE` | 400 | Page number is invalid |
| `INVALID_NAME` | 400 | Name parameter is empty or whitespace |
| `MISSING_VIEWER` | 400 | Required viewer parameter not provided |
| `INVALID_VIEWER` | 400 | Viewer parameter is empty or whitespace |
| `UNKNOWN_PARAMETER` | 400 | Unexpected query parameter |
| `DUPLICATE_PARAMETER` | 400 | Same query parameter provided multiple times |
| `UNKNOWN_FIELD` | 400 | Unexpected field in request body |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Content-Type header incorrect |

## Implementation

```python
# errors.py
class AppError(Exception):
    def __init__(self, code, message, status_code):
        self.code = code
        self.message = message
        self.status_code = status_code

def error_response(code, message, status_code):
    """Generate standard error response dict"""
    return {"error": message, "code": code}, status_code
```

## Acceptance Criteria

- [ ] All error codes defined as constants
- [ ] Helper function generates correct JSON structure
- [ ] HTTP status codes match spec
- [ ] AppError exception class for raising errors

## Dependencies

- **Blocked by:** agora-2 (project structure must exist)

---
**Created:** 2026-01-22
