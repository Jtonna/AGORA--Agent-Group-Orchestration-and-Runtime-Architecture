# EPIC: Phase 2 - Services Layer

**Type:** epic
**Status:** open
**Manager:** Services Manager
**Priority:** critical

## Description

Implement the business logic layer including inbox filtering, thread building, pagination, and read/delete status management.

## Scope

- Inbox filtering by viewer and deleted status
- Thread building with cycle detection
- Pagination helpers (10/page for inbox, 20/page for threads/investigation)
- Read status management
- Delete status management
- Unit tests for services

## Acceptance Criteria

- [ ] Inbox correctly filters by viewer participation
- [ ] Thread building traverses chains without stack overflow
- [ ] Cycle detection prevents infinite loops
- [ ] Pagination calculates correct totals and page info
- [ ] Read/delete operations are idempotent
- [ ] Unit tests cover all service functions

## Sub-tasks

- agora-12: Implement inbox filtering service
- agora-13: Implement thread building service
- agora-14: Implement pagination helpers
- agora-15: Implement read/delete status management
- agora-16: Unit tests for services

## Dependencies

- **Blocked by:** agora-6 (Phase 1 - Storage Layer must be complete)

---
**Created:** 2026-01-22
**Assignee:** Services Manager
