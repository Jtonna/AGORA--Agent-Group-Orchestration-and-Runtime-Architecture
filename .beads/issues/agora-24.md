# GET /investigation/{name} Endpoint

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** high
**Assignee:** Employee

## Description

Implement the investigation endpoint for admin access to all emails.

## Endpoint Spec

**Route:** `GET /investigation/{name}`

**Path Parameters:**
- `name` (required) - Name of person to investigate

**Query Parameters:**
- `page` (optional, default: 1)

**Pagination:** 20 items per page

**Response (200 OK):**
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
  "pagination": { ... }
}
```

## Behavior

- Returns ALL emails involving the person
- INCLUDES deleted emails
- INCLUDES readBy and deletedBy arrays
- Case-insensitive name matching

## Matching

Email matches if:
- `name` appears in `to` array (case-insensitive), OR
- `name` matches `from` field (case-insensitive)

## Error Check Order

1. `UNKNOWN_PARAMETER` / `DUPLICATE_PARAMETER`
2. `INVALID_NAME` (empty or whitespace-only)
3. `INVALID_PAGE`

## Acceptance Criteria

- [ ] Returns all emails for person
- [ ] Includes deleted emails
- [ ] Includes readBy and deletedBy in response
- [ ] Case-insensitive matching
- [ ] Pagination at 20 per page
- [ ] Sorted by timestamp descending

## Dependencies

- **Blocked by:** agora-23 (last endpoint in sequence)

---
**Created:** 2026-01-22
