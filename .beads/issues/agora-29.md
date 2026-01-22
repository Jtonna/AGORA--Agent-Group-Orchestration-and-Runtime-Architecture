# Create Bruno Collection Structure

**Type:** task
**Status:** open
**Epic:** agora-28 (Phase 4 - QA & Documentation)
**Priority:** high
**Assignee:** Employee

## Description

Set up the Bruno API collection structure with environments.

## Directory Structure

```
bruno/
└── the-corporations-email/
    ├── bruno.json           # Collection config
    ├── environments/
    │   └── local.bru        # Local environment
    ├── health.bru           # Health check
    ├── mail/                # Mail endpoints
    │   ├── get-inbox.bru
    │   ├── get-email.bru
    │   ├── send-email.bru
    │   └── delete-email.bru
    └── investigation/
        └── get-investigation.bru
```

## bruno.json

```json
{
  "version": "1",
  "name": "the-corporations-email",
  "type": "collection"
}
```

## local.bru

```
vars {
  baseUrl: http://localhost:60061
}
```

## Acceptance Criteria

- [ ] Collection imports into Bruno
- [ ] Environment variables work
- [ ] Directory structure matches spec
- [ ] All placeholder .bru files created

## Dependencies

- **Blocked by:** agora-27 (API must be testable)

---
**Created:** 2026-01-22
