# Bruno Requests for Investigation Endpoint

**Type:** task
**Status:** closed
**Epic:** agora-28 (Phase 4 - QA & Documentation)
**Priority:** high
**Assignee:** Employee

## Description

Create Bruno request file for the investigation endpoint.

## Files to Create

### investigation/get-investigation.bru
```
meta {
  name: Get Investigation
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/investigation/:name?page=1
  body: none
}

vars:pre-request {
  name: alice
}
```

## Additional Requests for Error Cases

Consider adding error case examples:

### investigation/errors/empty-name.bru
```
meta {
  name: Investigation - Empty Name
  type: http
  seq: 2
}

get {
  url: {{baseUrl}}/investigation/%20
  body: none
}

docs {
  Should return 400 INVALID_NAME
}
```

## Acceptance Criteria

- [ ] Investigation endpoint has request
- [ ] Path parameters work correctly
- [ ] Pagination works
- [ ] Error cases documented

## Dependencies

- **Blocked by:** agora-30 (follows same patterns)

---
**Created:** 2026-01-22
