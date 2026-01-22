# Email Subject Prefixes

All agent communication uses subject line prefixes to indicate the type of message.

---

## Task Assignment

### `GETTING STARTED:`
Used when assigning a task to an agent.

**Example:**
```
Subject: GETTING STARTED: Implement user authentication endpoint
```

### `ACKNOWLEDGED:`
Confirms receipt and understanding of an assignment.

**Example:**
```
Subject: ACKNOWLEDGED: Implement user authentication endpoint
```

---

## Requesting Help

All help requests are **blocking** - the sender waits for a response before proceeding.

### `QUESTION:`
Pre-work question. You need an answer before you can start.

**Example:**
```
Subject: QUESTION: Which authentication method should I use?
```

**When to use:**
- Unclear requirements
- Missing information in the task
- Need to confirm approach before starting

### `CLARIFICATION:`
During-work question. You're working but need guidance on how something should behave.

**Example:**
```
Subject: CLARIFICATION: Should the API return 401 or 403 for expired tokens?
```

**When to use:**
- Unsure how a feature should work
- Spec doesn't cover an edge case
- Need input on a design decision

### `BLOCKED:`
You're stuck and cannot continue. Something is broken or preventing progress.

**Example:**
```
Subject: BLOCKED: Tests failing due to missing database configuration
```

**When to use:**
- Build/tests failing and you can't fix it
- Dependency not available
- Environment issue
- Discovered a bug that blocks your work

---

## Peer Coordination

### `COLLABORATION REQUEST:`
Request to coordinate with another agent working on related functionality.

**Example:**
```
Subject: COLLABORATION REQUEST: Align on API response format for user endpoints
```

**When to use:**
- Frontend + backend agents need to agree on API contracts
- Two agents working on features that interact
- Preventing duplicate or conflicting implementations
- Sharing information that affects another agent's work

---

## Status Updates

### `PROGRESS:`
Sent after completing a plan phase to update supervisor on progress.

**Example:**
```
Subject: PROGRESS: Phase 1 complete - API endpoints implemented
```

**When to use:**
- After completing a phase of your plan
- To keep supervisor informed of progress
- Include what was done, issues encountered, what's next

### `IMPORTANT:`
Sent by supervisor to course-correct an employee mid-work.

**Example:**
```
Subject: IMPORTANT: Stop - the spec changed, check section 3.2
```

**When to use (supervisor only):**
- Employee is going in wrong direction
- Spec or requirements changed
- Urgent information that affects current work

**Employee behavior:** Check for IMPORTANT messages in every inbox check. If received, stop and adjust approach.

---

## Completion Loop

### `COMPLETE:`
Work is finished and ready for review.

**Example:**
```
Subject: COMPLETE: User authentication endpoint
```

### `APPROVED:`
Work has been reviewed and accepted.

**Example:**
```
Subject: APPROVED: User authentication endpoint
```

### `REVISION:`
Work needs changes before it can be accepted.

**Example:**
```
Subject: REVISION: User authentication endpoint - see feedback
```

---

## Reply Threading

When replying to any email, the server automatically prepends `Re:` to the subject.

**Example thread:**
```
CLARIFICATION: Should tokens expire after 24 hours?
  └── Re: CLARIFICATION: Should tokens expire after 24 hours?
        └── Re: Re: CLARIFICATION: Should tokens expire after 24 hours?
```

This keeps conversations threaded and traceable.
