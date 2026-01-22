# DELETE /mail/{mail_id} Endpoint

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement the soft-delete endpoint for emails.

## Endpoint Spec

**Route:** `DELETE /mail/{mail_id}`

**Query Parameters:**
- `viewer` (required) - Name of user deleting the email

**Response (200 OK):**
```json
{
  "message": "Email deleted"
}
```

## Behavior

- Adds viewer (lowercase) to `deletedBy` array
- Idempotent: deleting twice returns 200 (not error)
- Email still appears in thread views
- Email still appears in /investigation

## Access Control

- Viewer must be participant (in `to` or matches `from`)
- Non-participants get 403 `NOT_PARTICIPANT`

## Error Check Order

1. `UNKNOWN_PARAMETER` / `DUPLICATE_PARAMETER`
2. `MISSING_VIEWER`
3. `INVALID_VIEWER`
4. `INVALID_UUID` (mail_id format)
5. `EMAIL_NOT_FOUND`
6. `NOT_PARTICIPANT`

## Acceptance Criteria

- [ ] Adds viewer to deletedBy
- [ ] Idempotent (no error on re-delete)
- [ ] Only participants can delete
- [ ] Non-participants get 403
- [ ] All errors checked in correct order

## Dependencies

- **Blocked by:** agora-22 (follows similar patterns)

---
**Created:** 2026-01-22
