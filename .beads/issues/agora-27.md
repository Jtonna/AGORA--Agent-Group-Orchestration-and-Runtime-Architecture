# Integration Tests for Thread Chains

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** high
**Assignee:** Employee

## Description

Create integration tests for complex thread/reply chain scenarios.

## Test File

`tests/integration/test_thread_chains.py`

## Test Scenarios

### Basic Threading
- [ ] Single email has empty thread
- [ ] Reply shows parent in thread
- [ ] Parent shows child in thread
- [ ] Reply to reply (3 levels) builds correctly

### Complex Trees
- [ ] Multiple replies to same parent
- [ ] Branching conversations (A → B, A → C)
- [ ] Deep chains (5+ levels)
- [ ] Mix of branches and depth

### Edge Cases
- [ ] Orphan reference (parent deleted/quarantined)
- [ ] Self-reply (reply to own email)
- [ ] Cycle in data (defensive - should not crash)

### Deleted Emails in Threads
- [ ] Deleted email appears in thread summaries
- [ ] Can reply to deleted email
- [ ] Thread visible after middle email deleted
- [ ] Thread visible after root deleted

### Thread Sorting
- [ ] Newest first in thread list
- [ ] Consistent ordering across pages

### Reply Subject Handling
- [ ] "Re: " prepended for reply
- [ ] "Re: " not duplicated if already present
- [ ] Case-insensitive "re:" check

## Test Data Setup

Create fixtures for:
- Simple parent-child pair
- Deep reply chain (5 levels)
- Branching tree (1 parent, 3 children)
- Mixed tree with deletions

## Acceptance Criteria

- [ ] All thread scenarios tested
- [ ] Complex trees verified
- [ ] Deletion scenarios covered
- [ ] `pipenv run pytest tests/integration/test_thread_chains.py` passes

## Dependencies

- **Blocked by:** agora-26 (pagination tests establish patterns)

---
**Created:** 2026-01-22
