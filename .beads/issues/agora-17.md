# EPIC: Phase 3 - API Layer

**Type:** epic
**Status:** open
**Manager:** API Manager
**Priority:** critical

## Description

Implement all Flask routes with proper error handling, logging, and request validation. Create integration tests for all endpoints.

## Scope

- Flask app initialization with CORS
- Request logging middleware with transaction IDs
- Global request validation (Content-Type, unknown params)
- All 6 endpoints per spec
- Integration tests for all endpoints

## Acceptance Criteria

- [ ] Server starts on port 60061
- [ ] CORS allows all origins
- [ ] Transaction IDs appear in all logs
- [ ] All endpoints match spec behavior exactly
- [ ] Error responses use correct codes and HTTP status
- [ ] Integration tests cover happy paths and error cases

## Sub-tasks

- agora-18: Flask app setup with middleware
- agora-19: GET /health endpoint
- agora-20: GET /mail endpoint (inbox)
- agora-21: GET /mail/{id} endpoint (email detail + thread)
- agora-22: POST /mail endpoint (send email)
- agora-23: DELETE /mail/{id} endpoint
- agora-24: GET /investigation/{name} endpoint
- agora-25: Integration tests for endpoints
- agora-26: Integration tests for pagination
- agora-27: Integration tests for thread chains

## Dependencies

- **Blocked by:** agora-11 (Phase 2 - Services Layer must be complete)

---
**Created:** 2026-01-22
**Assignee:** API Manager
