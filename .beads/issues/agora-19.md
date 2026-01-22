# GET /health Endpoint

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** high
**Assignee:** Employee

## Description

Implement the health check endpoint.

## Endpoint Spec

**Route:** `GET /health`

**Query Parameters:** None (reject any with `UNKNOWN_PARAMETER`)

**Response (200 OK):**
```json
{
  "status": "ok"
}
```

## Implementation

```python
@app.route('/health', methods=['GET'])
def health():
    validate_query_params([])  # No params allowed
    return {"status": "ok"}, 200
```

## Errors

| Condition | Code | Status |
|-----------|------|--------|
| Any query param | `UNKNOWN_PARAMETER` | 400 |

## Acceptance Criteria

- [ ] Returns 200 with status ok
- [ ] Rejects any query parameters
- [ ] Response Content-Type is application/json

## Dependencies

- **Blocked by:** agora-18 (needs Flask app setup)

---
**Created:** 2026-01-22
