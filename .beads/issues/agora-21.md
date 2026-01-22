# GET /mail/{mail_id} Endpoint (Email Detail + Thread)

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement the email detail endpoint with thread building.

## Endpoint Spec

**Route:** `GET /mail/{mail_id}`

**Query Parameters:**
- `viewer` (required) - Name of user viewing email
- `thread_page` (optional, default: 1)

**Response (200 OK):**
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

## Behavior

- Returns full email content
- Auto-marks email as read for viewer
- Returns thread summaries (no content) for related emails
- Thread includes ALL emails regardless of delete status
- Thread excludes the requested email

## Error Check Order

1. `UNKNOWN_PARAMETER` / `DUPLICATE_PARAMETER`
2. `MISSING_VIEWER`
3. `INVALID_VIEWER`
4. `INVALID_UUID` (mail_id format)
5. `INVALID_PAGE` (thread_page)
6. `EMAIL_NOT_FOUND`
7. `EMAIL_DELETED` (by this viewer)

## Side Effects

- Adds viewer (lowercase) to `readBy` array

## Access Control

- Any viewer can access any email by ID
- Only checks if viewer deleted it

## Acceptance Criteria

- [ ] Returns full email with content
- [ ] Returns thread summaries without content
- [ ] Marks email as read (side effect)
- [ ] Thread includes deleted emails
- [ ] Thread pagination works
- [ ] All errors checked in correct order

## Dependencies

- **Blocked by:** agora-20 (follows similar pattern)

---
**Created:** 2026-01-22
