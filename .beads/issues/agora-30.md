# Bruno Requests for Mail Endpoints

**Type:** task
**Status:** open
**Epic:** agora-28 (Phase 4 - QA & Documentation)
**Priority:** high
**Assignee:** Employee

## Description

Create Bruno request files for all mail-related endpoints.

## Files to Create

### health.bru
```
meta {
  name: Health Check
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/health
  body: none
}
```

### mail/get-inbox.bru
```
meta {
  name: Get Inbox
  type: http
  seq: 1
}

get {
  url: {{baseUrl}}/mail?viewer=alice&page=1
  body: none
}
```

### mail/get-email.bru
```
meta {
  name: Get Email Detail
  type: http
  seq: 2
}

get {
  url: {{baseUrl}}/mail/:mail_id?viewer=alice&thread_page=1
  body: none
}
```

### mail/send-email.bru
```
meta {
  name: Send Email
  type: http
  seq: 3
}

post {
  url: {{baseUrl}}/mail
  body: json
}

headers {
  Content-Type: application/json; charset=utf-8
}

body:json {
  {
    "to": ["bob"],
    "from": "alice",
    "subject": "Hello",
    "content": "This is a test email."
  }
}
```

### mail/delete-email.bru
```
meta {
  name: Delete Email
  type: http
  seq: 4
}

delete {
  url: {{baseUrl}}/mail/:mail_id?viewer=alice
  body: none
}
```

## Acceptance Criteria

- [ ] All mail endpoints have requests
- [ ] Requests use environment variables
- [ ] Sample data is realistic
- [ ] Requests execute successfully against running server

## Dependencies

- **Blocked by:** agora-29 (needs collection structure)

---
**Created:** 2026-01-22
