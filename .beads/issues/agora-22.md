# POST /mail Endpoint (Send Email)

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement the send email endpoint.

## Endpoint Spec

**Route:** `POST /mail`

**Headers Required:**
- `Content-Type: application/json; charset=utf-8`

**Request Body:**
```json
{
  "to": ["recipient1", "recipient2"],
  "from": "sender_name",
  "subject": "Subject line",
  "content": "Email body content",
  "isResponseTo": "uuid-string-or-null"
}
```

**Response (201 Created):**
```json
{
  "id": "new-uuid",
  "message": "Email sent successfully"
}
```

## Auto-Generated Fields

- `id`: New UUID (validated unique)
- `timestamp`: Current datetime UTC
- `readBy`: []
- `deletedBy`: []

## Reply Behavior

If `isResponseTo` is provided and subject doesn't start with "Re: " (case-insensitive), prepend "Re: ".

## Error Check Order

1. `UNKNOWN_PARAMETER` / `DUPLICATE_PARAMETER`
2. `UNSUPPORTED_MEDIA_TYPE`
3. `INVALID_JSON`
4. `UNKNOWN_FIELD`
5. `MISSING_FIELD`
6. `INVALID_FIELD` (validation failures)
7. `INVALID_UUID` (isResponseTo format)
8. `PARENT_NOT_FOUND` (isResponseTo doesn't exist)

## Validation Error Messages

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

## Acceptance Criteria

- [ ] Creates email with all fields
- [ ] Generates unique UUID
- [ ] Timestamps in UTC with Z suffix
- [ ] Auto-prepends "Re: " for replies
- [ ] Validates Content-Type header
- [ ] Validates all fields per spec
- [ ] Rejects unknown fields
- [ ] Verifies parent exists for replies

## Dependencies

- **Blocked by:** agora-21 (follows similar patterns)

---
**Created:** 2026-01-22
