# GET /mail Endpoint (Inbox)

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Implement the inbox endpoint that returns email subjects for a user.

## Endpoint Spec

**Route:** `GET /mail`

**Query Parameters:**
- `viewer` (required) - Name of user viewing inbox
- `page` (optional, default: 1)

**Pagination:** 10 items per page

**Response (200 OK):**
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

## Implementation

```python
@app.route('/mail', methods=['GET'])
def get_inbox():
    validate_query_params(['viewer', 'page'])

    viewer = request.args.get('viewer')
    if viewer is None:
        raise AppError('MISSING_VIEWER', ...)
    if not viewer.strip():
        raise AppError('INVALID_VIEWER', ...)

    page = validate_page(request.args.get('page', 1))

    result = services.get_inbox(viewer.strip().lower(), page)
    return result, 200
```

## Error Check Order

1. `UNKNOWN_PARAMETER` / `DUPLICATE_PARAMETER`
2. `MISSING_VIEWER`
3. `INVALID_VIEWER`
4. `INVALID_PAGE`

## Acceptance Criteria

- [ ] Returns emails where viewer is sender or recipient
- [ ] Excludes deleted emails
- [ ] Sorted by timestamp descending
- [ ] Pagination works correctly
- [ ] `read` field reflects viewer's read status
- [ ] All errors return correct codes

## Dependencies

- **Blocked by:** agora-18 (needs Flask app setup)

---
**Created:** 2026-01-22
