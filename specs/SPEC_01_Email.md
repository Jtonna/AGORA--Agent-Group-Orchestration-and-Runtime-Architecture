# SPEC_01: The Corporations Email Server

## Overview

A Python Flask application providing an internal email system for "The Corporations". Simple REST API for sending, retrieving, and managing emails with support for threaded conversations.

**Project Name**: `the-corporations-email`

---

## Data Model

### Email Object

```json
{
  "id": "uuid-string",
  "to": ["name1", "name2"],
  "from": "sender_name",
  "subject": "Email subject line",
  "content": "Email body content (plain text)",
  "timestamp": "2024-01-15T10:30:00Z",
  "isResponseTo": "uuid-string or null",
  "readBy": [],
  "deletedBy": []
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string (UUID) | Unique identifier for the email |
| `to` | array of strings | One or more recipient names |
| `from` | string | Sender name |
| `subject` | string | Email subject line (no length limit) |
| `content` | string | Email body, plain text only (no length limit) |
| `timestamp` | string (ISO 8601 UTC) | When the email was sent (always UTC with Z suffix) |
| `isResponseTo` | string or null | ID of parent email if this is a reply |
| `readBy` | array of strings | Names of users who have read this email (case-insensitive) |
| `deletedBy` | array of strings | Names of users who have deleted this email from their inbox (case-insensitive) |

---

## Data Storage

### JSON File Storage

- **File**: `data/emails.json`
- **Quarantine File**: `data/quarantine.json`
- **Format**: Versioned JSON with email array
- **Persistence**: Read on startup, write on each modification

```json
{
  "version": 1,
  "emails": [
    { /* email object */ },
    { /* email object */ }
  ]
}
```

### Quarantine File Format

```json
{
  "version": 1,
  "quarantined": [
    {
      "original": { /* invalid email data */ },
      "reason": "missing required field: subject",
      "quarantined_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### File Operations

- Load entire file into memory on startup
- Write full file on each create/update operation
- Create file with empty array if not exists

### Storage Architecture

- **Singleton pattern**: A single storage instance acts as the database layer
- **Queued access**: All read and write operations are queued through the singleton to prevent concurrent file access issues
- **Abstraction**: The singleton exposes database-like methods (get, create, update, delete) to decouple storage implementation from business logic
- **Future migration**: This architecture allows replacing JSON file storage with SQLite or another database with minimal changes to the service layer

### Startup Validation

On startup, validate all emails in `data/emails.json`:

1. **If emails.json doesn't exist**: Create with `{"version": 1, "emails": []}`
2. **If quarantine.json doesn't exist**: Create with `{"version": 1, "quarantined": []}`
3. **If emails.json is invalid JSON or wrong structure**: Log error, refuse to start (manual intervention required)
4. **If quarantine.json is invalid** (invalid JSON, wrong structure, missing version, or unsupported version): Log warning, rename to `quarantine.json.bak.<timestamp>` (e.g., `quarantine.json.bak.2024-01-15T10-30-00Z`), create fresh `{"version": 1, "quarantined": []}`
5. **If emails.json has unsupported version** (not `1` or `"1"`): Log warning, rename to `emails.json.old.<timestamp>`, create fresh `{"version": 1, "emails": []}` (allows future schema migrations without blocking startup)
6. **For each email in the array**:
   - Attempt to fix recoverable issues (normalize names to lowercase, trim strings)
   - If unfixable (missing required fields, wrong types), move to quarantine file
   - Log all fixes and quarantine actions

### Recoverable Issues (auto-fix)

- Missing `emails` key in data file → default to `[]`
- Names not lowercase → normalize to lowercase
- Strings with extra whitespace → trim
- Missing `readBy` or `deletedBy` → default to `[]`
- Non-string elements in `readBy` or `deletedBy` → filter out, keep only valid strings
- Duplicate names in `to`, `readBy`, or `deletedBy` → dedupe
- Version field is string `"1"` instead of integer `1` → convert to integer
- Extra fields not in schema → strip silently

### Unrecoverable Issues (quarantine)

- Missing required fields (`id`, `to`, `from`, `subject`, `content`, `timestamp`)
- Wrong field types (`to` not an array, `from` not a string, etc.)
- Invalid UUID format for `id` or `isResponseTo`
- Invalid timestamp format
- Duplicate `id` values (all emails sharing the same ID are quarantined)

### Orphaned References (leave as-is)

- If `isResponseTo` is a valid UUID but references a non-existent email, leave unchanged
- Thread building will treat the email as a root (parent not found during traversal)
- This can occur if referenced email was quarantined or manually removed

---

## Standard Error Format

All error responses follow this structure:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE"
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `EMAIL_NOT_FOUND` | 404 | Email ID does not exist |
| `EMAIL_DELETED` | 404 | Email was deleted by this viewer |
| `NOT_PARTICIPANT` | 403 | Viewer is not a participant (to/from) of this email |
| `PARENT_NOT_FOUND` | 400 | isResponseTo references non-existent email |
| `MISSING_FIELD` | 400 | Required field not provided |
| `INVALID_FIELD` | 400 | Field value is invalid (e.g., empty `to` array) |
| `INVALID_JSON` | 400 | Request body is not valid JSON |
| `INVALID_UUID` | 400 | mail_id is not a valid UUID format |
| `INVALID_PAGE` | 400 | Page number is invalid (must be positive integer) |
| `INVALID_NAME` | 400 | Name parameter is empty or whitespace-only |
| `MISSING_VIEWER` | 400 | Required `viewer` parameter not provided |
| `INVALID_VIEWER` | 400 | Viewer parameter is empty or whitespace-only |
| `UNKNOWN_PARAMETER` | 400 | Unexpected query parameter provided |
| `DUPLICATE_PARAMETER` | 400 | Same query parameter provided multiple times |
| `UNKNOWN_FIELD` | 400 | Unexpected field in request body |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | Content-Type header must be application/json; charset=utf-8 |

---

## API Endpoints

All endpoints return JSON with `Content-Type: application/json; charset=utf-8`. All list endpoints are **paginated**.

**Global Request Requirements**:
- All endpoints with request bodies require `Content-Type: application/json; charset=utf-8`
  - Media type must be exactly `application/json`
  - Charset must be `utf-8` (case-insensitive, so `UTF-8` is also accepted)
  - Whitespace around semicolon is optional (`application/json;charset=utf-8` also accepted)
  - Header name is case-insensitive per HTTP standard
- Missing or incorrect Content-Type returns 415 `UNSUPPORTED_MEDIA_TYPE`

**Strict Input Validation**:
- All endpoints reject unexpected query parameters with 400 `UNKNOWN_PARAMETER`
- All endpoints reject duplicate query parameters with 400 `DUPLICATE_PARAMETER` (e.g., `?viewer=alice&viewer=bob`)
- POST endpoints reject unexpected fields in request body with 400 `UNKNOWN_FIELD`
- Only documented parameters and fields are accepted

**Error Check Order**:
Global validation errors are always checked first, before endpoint-specific errors:
1. `UNKNOWN_PARAMETER` / `DUPLICATE_PARAMETER` (query string validation)
2. `UNSUPPORTED_MEDIA_TYPE` (Content-Type validation, POST only)
3. `INVALID_JSON` / `UNKNOWN_FIELD` (request body validation, POST only)
4. Endpoint-specific errors (as documented per endpoint)

---

### GET /health

Health check endpoint for monitoring.

**Query Parameters**: None (rejects any query parameters with 400 `UNKNOWN_PARAMETER`)

**Response** (200 OK):
```json
{
  "status": "ok"
}
```

---

### Pagination Format

All paginated responses follow this structure:

```json
{
  "data": [],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total_items": 47,
    "total_pages": 5,
    "has_next": true,
    "has_prev": false
  }
}
```

Query parameters for pagination:
- `page` (default: 1) - Page number (1-indexed)

**Page Validation**:
- Page must be a positive integer (400 `INVALID_PAGE` if 0, negative, or non-numeric)
- Page exceeding total pages returns 400 `INVALID_PAGE`

**Empty Results**:
- When no items match, return `{data: [], pagination: {page: 1, per_page: X, total_items: 0, total_pages: 1, has_next: false, has_prev: false}}`

---

### GET /mail

Get all email subjects for a user's inbox. Only shows emails where the viewer is a recipient or sender.

**Pagination**: 10 items per page

**Query Parameters**:
- `viewer` (required) - Name of the user viewing their inbox
- `page` (optional, default: 1)

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "from": "sender_name",
      "to": ["recipient1", "recipient2"],
      "subject": "Subject line",
      "timestamp": "2024-01-15T10:30:00Z",
      "isResponseTo": null,
      "read": false
    }
  ],
  "pagination": { /* ... */ }
}
```

**Filtering**:
1. Only emails where `viewer` is in `to` array OR `viewer` matches `from` (case-insensitive)
2. Excludes emails where `viewer` is in `deletedBy` array (case-insensitive)

**Response field `read`**: true if `viewer` is in `readBy` array, false otherwise

**Sorting**: By timestamp descending (most recent first)

**Errors** (checked in this order):
1. 400 `MISSING_VIEWER` if `viewer` parameter not provided
2. 400 `INVALID_VIEWER` if `viewer` is empty or whitespace-only
3. 400 `INVALID_PAGE` if `page` is invalid

---

### GET /mail/{mail_id}

Get a specific email with full content, plus summaries of other emails in the conversation thread.

**Query Parameters**:
- `viewer` (required) - Name of the user viewing the email
- `thread_page` (optional, default: 1) - Page number for thread summaries

**Behavior**:
- Returns the requested email with full content (if not deleted by viewer)
- Returns thread summaries (metadata only, no content) for other emails in the chain
- **Thread includes ALL emails** regardless of delete status (deleted emails still appear in threads)
- **Auto-marks** the requested email as read (adds `viewer` to `readBy` array, case-insensitive)

**Response**:
```json
{
  "email": {
    "id": "uuid",
    "from": "sender_name",
    "to": ["recipient"],
    "subject": "Re: Subject",
    "content": "Full email body...",
    "timestamp": "2024-01-15T10:30:00Z",
    "isResponseTo": "parent-uuid",
    "read": true
  },
  "thread": [
    {
      "id": "uuid",
      "from": "sender_name",
      "to": ["recipient"],
      "subject": "Original Subject",
      "timestamp": "2024-01-14T09:00:00Z",
      "isResponseTo": null
    }
  ],
  "thread_pagination": {
    "page": 1,
    "per_page": 20,
    "total_in_thread": 45,
    "total_pages": 3,
    "has_next": true,
    "has_prev": false
  }
}
```

**Response Details**:
- `email`: Full email object including `content`. Field `read` is true if viewer is in `readBy`.
- `thread`: Array of **summary objects only** (id, from, to, subject, timestamp, isResponseTo) - excludes the requested email. Sorted by timestamp descending (newest first). **Paginated: 20 per page.** Empty array `[]` if no related emails.
- `thread_pagination`: Pagination info for thread summaries. For empty thread: `{page: 1, per_page: 20, total_in_thread: 0, total_pages: 1, has_next: false, has_prev: false}`

**Thread Building**:
1. Find root email by following `isResponseTo` chain upward
   - Use visited set to detect cycles (defensive - stops traversal if corruption detected)
   - Must use iteration (not recursion) to avoid stack overflow with deep chains
2. Find all descendants by scanning for emails with `isResponseTo` pointing to any email in the thread
3. Exclude the requested email from the thread array (it's already in `email`)
4. Sort by timestamp descending (newest first)
5. Paginate to 20 summaries per page

**Access Control**:
- Any viewer can access any email by ID (no participation required)
- Only checks if viewer has deleted the email

**Side Effects**:
- Adds `viewer` (lowercase) to `readBy` array (if not already present - deduped)

**Errors** (checked in this order):
1. 400 `MISSING_VIEWER` if `viewer` parameter not provided
2. 400 `INVALID_VIEWER` if `viewer` is empty or whitespace-only
3. 400 `INVALID_UUID` if `mail_id` is not valid UUID format
4. 400 `INVALID_PAGE` if `thread_page` is invalid
5. 404 `EMAIL_NOT_FOUND` if email does not exist
6. 404 `EMAIL_DELETED` if email was deleted by this viewer

---

### POST /mail

Send a new email.

**Request Body**:
```json
{
  "to": ["recipient1", "recipient2"],
  "from": "sender_name",
  "subject": "Subject line",
  "content": "Email body content",
  "isResponseTo": "uuid-string-or-null"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `to` | Yes | Array of recipient names (min 1) |
| `from` | Yes | Sender name |
| `subject` | Yes | Subject line |
| `content` | Yes | Email body (plain text) |
| `isResponseTo` | No | Parent email ID for replies |

**Response** (201 Created):
```json
{
  "id": "new-uuid",
  "message": "Email sent successfully"
}
```

**Auto-generated fields**:
- `id`: New UUID (randomly generated, validated unique against existing emails before insert)
- `timestamp`: Current datetime (ISO 8601 UTC with Z suffix)
- `readBy`: []
- `deletedBy`: []

**Reply Behavior**:
- If `isResponseTo` is provided and `subject` does not start with "Re: " (case-insensitive check), automatically prepend "Re: " to subject
- Replying to a deleted email is allowed (parent email will appear in thread view)

**Request Requirements**:
- Content-Type header must be `application/json; charset=utf-8` (see Global Request Requirements)
- Request body must be valid JSON (400 `INVALID_JSON` if malformed)

**Validation** (all strings are trimmed, all names converted to lowercase):
- `to` must be non-empty array with at least one non-whitespace name
- `to` must contain only strings (400 `INVALID_FIELD` if any element is not a string)
- `to` names are deduped silently (duplicates removed)
- `to` must not contain any empty/whitespace-only names after trimming (reject entire request)
- `from` must be non-empty string (not just whitespace)
- `subject` must be non-empty string (not just whitespace)
- `content` must be non-empty string (not just whitespace)
- `isResponseTo` must be a string or null (400 `INVALID_FIELD` if wrong type)
- `isResponseTo` empty string `""` is treated as `null` (not a reply)
- If `isResponseTo` provided (non-null/non-empty):
  1. Validate UUID format (400 `INVALID_UUID` if invalid)
  2. Verify parent email exists (400 `PARENT_NOT_FOUND` if not)
- Self-email is allowed (`from` can appear in `to`)

**Note on Cycles**:
- Cycles are structurally impossible during normal operation since new emails can only reference existing emails (the new email has no ID until created, so nothing can reference it yet)
- The `PARENT_NOT_FOUND` validation ensures `isResponseTo` points to a valid existing email
- Cycle detection is implemented in **thread building** (GET /mail/{id}) as defensive programming against corrupted data or manually edited JSON files

**Errors** (checked in this order):
1. 415 `UNSUPPORTED_MEDIA_TYPE` if Content-Type not `application/json; charset=utf-8`
2. 400 `INVALID_JSON` if body is not valid JSON
3. 400 `UNKNOWN_FIELD` if request body contains unexpected fields
4. 400 `MISSING_FIELD` if required field not provided
5. 400 `INVALID_FIELD` for validation failures (see messages below)
6. 400 `INVALID_UUID` if `isResponseTo` is not valid UUID format
7. 400 `PARENT_NOT_FOUND` if `isResponseTo` email doesn't exist

**Validation Error Messages** (400 `INVALID_FIELD`):
- `"to must be an array"`
- `"to must contain only strings"`
- `"to must contain at least one recipient"`
- `"to contains empty or whitespace-only names"`
- `"from must be a string"`
- `"from cannot be empty or whitespace"`
- `"subject must be a string"`
- `"subject cannot be empty or whitespace"`
- `"content must be a string"`
- `"content cannot be empty or whitespace"`
- `"isResponseTo must be a string or null"`

---

### DELETE /mail/{mail_id}

Soft-delete an email for a specific user. Adds the viewer's name to the `deletedBy` array.

**Query Parameters**:
- `viewer` (required) - Name of the user deleting the email

**Access Control**:
- Viewer must be a participant (in `to` array OR matches `from`) to delete
- Non-participants receive 403 `NOT_PARTICIPANT`

**Behavior**:
- Validates `mail_id` is valid UUID format (400 `INVALID_UUID` if not)
- Adds `viewer` (lowercase) to the email's `deletedBy` array (if not already present - deduped)
- Email will no longer appear in this viewer's inbox (GET /mail)
- Email will return 404 for this viewer on direct access (GET /mail/{id})
- Email **still appears** in thread views for all users
- Email **still appears** in /investigation endpoint
- **Idempotent**: If already deleted by this viewer, still returns 200 (no error)

**Response** (200 OK):
```json
{
  "message": "Email deleted"
}
```

**Errors** (checked in this order):
1. 400 `MISSING_VIEWER` if `viewer` parameter not provided
2. 400 `INVALID_VIEWER` if `viewer` is empty or whitespace-only
3. 400 `INVALID_UUID` if `mail_id` is not valid UUID format
4. 404 `EMAIL_NOT_FOUND` if email does not exist
5. 403 `NOT_PARTICIPANT` if viewer is not in `to` or `from`

---

### GET /investigation/{name}

Get all emails involving a person, **including emails deleted by anyone**. For administrative/investigation purposes.

**Pagination**: 20 items per page

**Path Parameters**:
- `name` (required) - Name of person to investigate (trimmed, case-insensitive)

**Query Parameters**:
- `page` (optional, default: 1)

**Matching**: Returns emails where `name` appears in `to` array OR matches `from` field (case-insensitive)

**Errors** (checked in this order):
1. 400 `INVALID_NAME` if `name` is empty or whitespace-only after trimming
2. 400 `INVALID_PAGE` if `page` is invalid

**Response**:
```json
{
  "data": [
    {
      "id": "uuid",
      "from": "sender_name",
      "to": ["recipient"],
      "subject": "Subject line",
      "content": "Full email body...",
      "timestamp": "2024-01-15T10:30:00Z",
      "isResponseTo": null,
      "readBy": ["alice"],
      "deletedBy": ["jacob"]
    }
  ],
  "pagination": { /* ... */ }
}
```

**Note**: `readBy` and `deletedBy` arrays are included in response to show full email state for investigation purposes

**Sorting**: By timestamp descending (most recent first)

---

## Project Structure

```
the-corporations-email/
├── app.py              # Flask routes
├── models.py           # Email model and validation
├── services.py         # Business logic layer
├── storage.py          # JSON file operations
├── errors.py           # Error codes and helpers
├── Pipfile             # Pipenv dependencies
├── Pipfile.lock        # Locked dependencies
├── data/
│   ├── emails.json     # Email data storage
│   └── quarantine.json # Invalid emails moved here on startup
├── tests/
│   ├── __init__.py
│   ├── conftest.py     # Shared fixtures
│   ├── unit/
│   │   ├── __init__.py
│   │   ├── test_models.py
│   │   ├── test_storage.py
│   │   └── test_services.py
│   └── integration/
│       ├── __init__.py
│       ├── test_endpoints.py
│       ├── test_pagination.py
│       └── test_thread_chains.py
├── bruno/
│   └── the-corporations-email/
│       ├── bruno.json
│       ├── environments/
│       │   └── local.bru
│       ├── health.bru
│       ├── mail/
│       │   ├── get-inbox.bru
│       │   ├── get-email.bru
│       │   ├── send-email.bru
│       │   └── delete-email.bru
│       └── investigation/
│           └── get-investigation.bru
└── README.md           # Setup and usage instructions
```

---

## Dependencies

Managed with **pipenv** (`Pipfile` / `Pipfile.lock`)

**Production:**
- flask
- flask-cors

**Development:**
- pytest

**Standard Library (no install needed):**
- uuid
- datetime
- json

---

## Server Configuration

**Port**: `60061`

**CORS**: Unrestricted - allows requests from any origin (frontend apps, other servers, etc.)

**Startup Behavior**:
- Creates `data/` directory if it doesn't exist
- Validates and loads `data/emails.json` (see **Data Storage > Startup Validation** for details)
- Auto-fixes recoverable issues, quarantines invalid emails
- Server never seeds sample data automatically

---

## Logging

### Transaction ID
- Each incoming HTTP request is assigned a unique **8-character hex ID** (e.g., `a1b2c3d4`)
- Generated at request start, included in all subsequent log entries for that request
- Allows tracing a complete request lifecycle in logs

### Log Format
```
[{timestamp}] [{transaction_id}] [{level}] {message}
```

Example:
```
[2024-01-15T10:30:00Z] [a1b2c3d4] [INFO] REQUEST: POST /mail
[2024-01-15T10:30:00Z] [a1b2c3d4] [INFO] BODY: {"to": ["alice"], "from": "bob", ...}
[2024-01-15T10:30:01Z] [a1b2c3d4] [INFO] RESPONSE: 201 {"id": "uuid-123", "message": "Email sent successfully"}
```

### Log Levels
- `INFO` - Requests, responses, bodies, startup summary
- `DEBUG` - Detailed storage operations, validation steps
- `ERROR` - All errors, exceptions, stack traces

### What to Log

| Event | Level | Details |
|-------|-------|---------|
| Incoming request | INFO | Method, path, query params |
| Request body | INFO | Full JSON body (POST requests) |
| Response | INFO | Status code, full response body |
| Errors | ERROR | Error code, message, stack trace |
| Startup validation | INFO | Files created, auto-fixes applied, emails quarantined |
| Storage operations | DEBUG | Read/write actions |

### Output
- **Print to stdout only** (no file logging)
- Logs are in-memory and visible in terminal during server execution

---

## Testing Strategy

### Unit Tests (pytest)
Location: `tests/unit/`

| File | Coverage |
|------|----------|
| `test_models.py` | Email validation, name normalization, whitespace trimming, type validation |
| `test_storage.py` | JSON read/write, file creation, data integrity, startup validation, quarantine |
| `test_services.py` | Thread building, pagination, filtering logic, cycle detection |

### Integration Tests (pytest + Flask test client)
Location: `tests/integration/`

| File | Coverage |
|------|----------|
| `test_endpoints.py` | Full request/response cycle for all endpoints |
| `test_pagination.py` | Pagination across all list endpoints |
| `test_thread_chains.py` | Complex thread scenarios with replies and deletions |

### Bruno Collection
Location: `bruno/the-corporations-email/`

- Organized by endpoint (`mail/`, `investigation/`)
- Environment variables for base URL and port
- Example requests for all endpoints and error cases

---

## Development Methodology

Follow a test-driven, layered approach:

### Phase 1: Data Models
1. Create `models.py` with Email dataclass/schema
2. Implement validation functions (name normalization, whitespace trimming)
3. Write unit tests for all validation logic

### Phase 2: Storage Layer
1. Create `storage.py` with JSON file operations
2. Implement read/write with file creation handling
3. Write unit tests for storage operations

### Phase 3: Service Layer
1. Create `services.py` with business logic:
   - Thread building with cycle detection
   - Inbox filtering (by viewer, deleted status)
   - Pagination helpers
   - Read/delete status management
2. Write unit tests for each service function

### Phase 4: API Layer
1. Create `app.py` with Flask routes
2. Create `errors.py` with error response helpers
3. Write integration tests for all endpoints

### Phase 5: Manual Testing
1. Create Bruno collection
2. Verify all endpoints manually
3. Test edge cases

---

## Summary

| Endpoint | Method | Pagination | Viewer Required | Shows Deleted |
|----------|--------|------------|-----------------|---------------|
| `/health` | GET | - | No | - |
| `/mail` | GET | 10/page | Yes | No (filtered by viewer) |
| `/mail/{id}` | GET | Thread: 20/page | Yes | In thread: Yes. Target: No |
| `/mail` | POST | - | No | - |
| `/mail/{id}` | DELETE | - | Yes (participant only) | - |
| `/investigation/{name}` | GET | 20/page | No | **Yes (all)** |

---

## Key Behaviors

1. **Per-user deletion**: Deleting an email only hides it from that user's inbox. Other users can still see it. Only participants (in `to` or `from`) can delete.

2. **Per-user read status**: Each user has their own read/unread state for emails. Reading an email only marks it read for that viewer. `readBy` is deduped (reading twice doesn't add duplicate entries).

3. **Inbox filtering**: GET /mail only shows emails where you are a recipient (`to`) or sender (`from`).

4. **Open viewing**: Anyone can view any email by ID (GET /mail/{id}) - no participation required. Only checks if viewer deleted it.

5. **Thread preservation**: Deleted emails always appear in thread views. This mirrors real email behavior where deleting your copy doesn't affect the conversation history.

6. **Thread summaries**: GET /mail/{id} returns full content for the requested email, plus summaries (id, from, to, subject, timestamp, isResponseTo) for other emails in the thread.

7. **Reply to deleted**: Users can reply to emails that have been deleted (by anyone). The full thread chain remains visible in thread view.

8. **Auto "Re:" prefix**: When replying (isResponseTo set), subject automatically gets "Re: " prepended if not already present.

9. **Plain text only**: Content field is plain text. No HTML or rich text support.

10. **No length limits**: Subject and content have no maximum length restrictions.

11. **Name normalization**: All names (`to`, `from`, `viewer`, `deletedBy`, `readBy`) are converted to **lowercase** before storage and comparison. "Jacob" and "jacob" are treated as the same person.

12. **Name deduplication**: Duplicate names in `to` array are silently removed.

13. **Whitespace validation**: All string fields are trimmed. Empty or whitespace-only values are rejected with descriptive error messages.

14. **Self-email allowed**: Users can send emails to themselves (`from` can appear in `to`).

15. **Cycle prevention**: Cycles are structurally impossible (new emails can only reference existing ones). Thread building uses defensive cycle detection when traversing chains in case of data corruption.

16. **Idempotent delete**: Deleting an already-deleted email returns 200 success (not an error).

17. **UTC timestamps**: All timestamps are stored and returned in UTC with Z suffix.

18. **UUID validation**: All mail_id parameters are validated for UUID format.

19. **Strict pagination**: Invalid page numbers (0, negative, non-numeric, or exceeding total) return errors.

20. **Schema versioning**: Data files include a `version` field for future migrations.

21. **Startup validation**: On startup, emails are validated - recoverable issues are auto-fixed, unrecoverable issues are quarantined to `quarantine.json`.

22. **Strict input validation**: Unknown query parameters and unknown request body fields are rejected with errors.

23. **Request tracing**: Each request gets an 8-char hex transaction ID. All logs for that request include the ID for traceability. Logs print to stdout only.
