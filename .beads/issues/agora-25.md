# Integration Tests for Endpoints

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** high
**Assignee:** Employee

## Description

Create integration tests for all endpoints using Flask test client.

## Test File

`tests/integration/test_endpoints.py`

## Test Cases

### Health Endpoint
- [ ] Returns 200 with status ok
- [ ] Rejects query parameters

### GET /mail (Inbox)
- [ ] Returns emails for viewer
- [ ] Filters by participation
- [ ] Excludes deleted emails
- [ ] Returns read status per viewer
- [ ] Sorted newest first
- [ ] Missing viewer returns 400
- [ ] Empty viewer returns 400

### GET /mail/{id} (Detail)
- [ ] Returns full email with content
- [ ] Returns thread summaries
- [ ] Marks as read (side effect)
- [ ] Missing viewer returns 400
- [ ] Invalid UUID returns 400
- [ ] Not found returns 404
- [ ] Deleted returns 404

### POST /mail (Send)
- [ ] Creates email successfully
- [ ] Returns 201 with new ID
- [ ] Auto-prepends "Re:" for replies
- [ ] Missing Content-Type returns 415
- [ ] Invalid JSON returns 400
- [ ] Missing fields return 400
- [ ] Invalid fields return 400
- [ ] Unknown fields return 400
- [ ] Invalid parent returns 400

### DELETE /mail/{id}
- [ ] Deletes successfully
- [ ] Returns 200
- [ ] Idempotent (delete twice OK)
- [ ] Non-participant returns 403
- [ ] Invalid UUID returns 400
- [ ] Not found returns 404

### GET /investigation/{name}
- [ ] Returns all emails for person
- [ ] Includes deleted emails
- [ ] Includes readBy/deletedBy
- [ ] Empty name returns 400

## Test Setup

Use pytest fixtures for:
- Flask test client
- Temporary storage file
- Sample emails

## Acceptance Criteria

- [ ] All test cases implemented
- [ ] Tests use Flask test client
- [ ] Tests are isolated
- [ ] `pipenv run pytest tests/integration/test_endpoints.py` passes

## Dependencies

- **Blocked by:** agora-24 (all endpoints must exist)

---
**Created:** 2026-01-22
