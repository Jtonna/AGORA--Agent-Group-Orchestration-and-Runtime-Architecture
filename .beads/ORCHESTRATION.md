# Agent Orchestration Workflow

## Hierarchy Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CTO (Orchestrator)                       │
│  - Owns overall project vision                                   │
│  - Assigns phases to Managers                                    │
│  - Reviews phase completion                                      │
│  - Handles escalations                                           │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐     ┌───────────────┐     ┌───────────────┐
│   Manager 1   │     │   Manager 2   │     │   Manager N   │
│  (Phase Lead) │     │  (Phase Lead) │     │  (Phase Lead) │
│               │     │               │     │               │
│ - Owns phase  │     │ - Owns phase  │     │ - Owns phase  │
│ - Creates     │     │ - Creates     │     │ - Creates     │
│   tickets     │     │   tickets     │     │   tickets     │
│ - Assigns to  │     │ - Assigns to  │     │ - Assigns to  │
│   employees   │     │   employees   │     │   employees   │
│ - Reviews PRs │     │ - Reviews PRs │     │ - Reviews PRs │
└───────┬───────┘     └───────┬───────┘     └───────┬───────┘
        │                     │                     │
    ┌───┴───┐             ┌───┴───┐             ┌───┴───┐
    ▼       ▼             ▼       ▼             ▼       ▼
┌──────┐ ┌──────┐     ┌──────┐ ┌──────┐     ┌──────┐ ┌──────┐
│ Emp1 │ │ Emp2 │     │ Emp1 │ │ Emp2 │     │ Emp1 │ │ Emp2 │
│      │ │      │     │      │ │      │     │      │ │      │
│ Does │ │ Does │     │ Does │ │ Does │     │ Does │ │ Does │
│ work │ │ work │     │ work │ │ work │     │ work │ │ work │
└──────┘ └──────┘     └──────┘ └──────┘     └──────┘ └──────┘
```

## Phase Structure

### Phase 0: Foundation (Epic: agora-1)
**Manager:** Foundation Manager
**Employees:** 2-3 concurrent

| Task ID | Task | Blocked By | Parallelizable |
|---------|------|------------|----------------|
| agora-2 | Initialize project structure | - | Yes |
| agora-3 | Create error module | agora-2 | Yes |
| agora-4 | Create Email model | agora-3 | Yes |
| agora-5 | Unit tests for models | agora-4 | Yes |

### Phase 1: Storage Layer (Epic: agora-6)
**Manager:** Storage Manager
**Employees:** 2 concurrent

| Task ID | Task | Blocked By | Parallelizable |
|---------|------|------------|----------------|
| agora-7 | Create storage singleton | agora-1 | Yes |
| agora-8 | Implement startup validation | agora-7 | Yes |
| agora-9 | Implement quarantine logic | agora-8 | Yes |
| agora-10 | Unit tests for storage | agora-9 | Yes |

### Phase 2: Services Layer (Epic: agora-11)
**Manager:** Services Manager
**Employees:** 3 concurrent

| Task ID | Task | Blocked By | Parallelizable |
|---------|------|------------|----------------|
| agora-12 | Inbox filtering service | agora-6 | Yes |
| agora-13 | Thread building service | agora-12 | With 14, 15 |
| agora-14 | Pagination helpers | agora-12 | With 13, 15 |
| agora-15 | Read/delete status mgmt | agora-13 | With 13, 14 |
| agora-16 | Unit tests for services | agora-15 | Yes |

### Phase 3: API Layer (Epic: agora-17)
**Manager:** API Manager
**Employees:** 4 concurrent (endpoints can parallelize)

| Task ID | Task | Blocked By | Parallelizable |
|---------|------|------------|----------------|
| agora-18 | Flask app setup | agora-11 | Yes |
| agora-19 | GET /health | agora-18 | With 20-24 |
| agora-20 | GET /mail | agora-18 | With 19, 21-24 |
| agora-21 | GET /mail/{id} | agora-18 | With 19-20, 22-24 |
| agora-22 | POST /mail | agora-18 | With 19-21, 23-24 |
| agora-23 | DELETE /mail/{id} | agora-18 | With 19-22, 24 |
| agora-24 | GET /investigation | agora-18 | With 19-23 |
| agora-25 | Integration tests | agora-24 | Yes |
| agora-26 | Pagination tests | agora-25 | Yes |
| agora-27 | Thread chain tests | agora-26 | Yes |

### Phase 4: QA & Documentation (Epic: agora-28)
**Manager:** QA Manager
**Employees:** 2 concurrent

| Task ID | Task | Blocked By | Parallelizable |
|---------|------|------------|----------------|
| agora-29 | Bruno collection structure | agora-17 | Yes |
| agora-30 | Bruno mail requests | agora-29 | With 31 |
| agora-31 | Bruno investigation requests | agora-30 | With 30 |
| agora-32 | README documentation | agora-31 | Yes |

---

## Orchestration Protocol

### CTO Commands

```
# Start a phase
/cto:start-phase <phase-number>

# Check phase status
/cto:phase-status <phase-number>

# Escalation handling
/cto:review-blocker <issue-id>
```

### Manager Commands

```
# Claim phase
/manager:claim-phase <epic-id>

# Assign work to employee
/manager:assign <task-id> <employee-id>

# Review employee submission
/manager:review <task-id>

# Report phase complete
/manager:phase-complete <epic-id>
```

### Employee Commands

```
# Claim task
/employee:claim <task-id>

# Report progress
/employee:update <task-id> <status>

# Submit for review
/employee:submit <task-id>

# Report blocker
/employee:blocked <task-id> <reason>
```

---

## Communication Flow

### Downward (Assignment)
```
CTO → Manager: "Start Phase 0, Foundation"
Manager → Employee: "Work on agora-2, project structure"
```

### Upward (Reporting)
```
Employee → Manager: "agora-2 complete, ready for review"
Manager → CTO: "Phase 0 complete, all tests passing"
```

### Lateral (Handoff)
```
Manager A → Manager B: "Phase 0 complete, Phase 1 unblocked"
```

---

## Execution Model

### Sequential Phases
Phases must complete in order due to dependencies:
```
Phase 0 → Phase 1 → Phase 2 → Phase 3 → Phase 4
```

### Parallel Tasks Within Phase
Multiple employees can work concurrently on non-blocking tasks:

```
Phase 3 Example:
├── Employee 1: agora-19 (health endpoint)
├── Employee 2: agora-20 (inbox endpoint)  } Parallel
├── Employee 3: agora-21 (email detail)    }
└── Employee 4: agora-22 (send email)      }
```

---

## Agent Implementation Notes

### CTO Agent
- Maintains global state of all phases
- Spawns Manager agents for each phase
- Monitors for blockers and escalations
- Final sign-off on deliverables

### Manager Agent
- Receives phase epic from CTO
- Breaks down into assignable tasks (already done via tickets)
- Spawns Employee agents for tasks
- Collects results and validates
- Reports completion to CTO

### Employee Agent
- Receives single task
- Reads spec and ticket requirements
- Implements solution
- Runs relevant tests
- Submits code for review
- Responds to review feedback

---

## Issue Status Flow

```
open → in_progress → review → done
         │
         └─→ blocked (needs escalation)
```

---

## Metrics Tracking

### Per Phase
- Start time
- End time
- Tasks completed
- Blockers encountered
- Review cycles

### Per Employee
- Tasks completed
- Average completion time
- Review pass rate

---

## Error Handling

### Employee Blocked
1. Employee marks task as blocked
2. Manager receives notification
3. Manager attempts resolution
4. If unresolved, escalate to CTO

### Test Failures
1. Employee runs tests
2. If failing, fix and re-run
3. Only submit when tests pass
4. Manager re-runs tests on review

### Review Rejection
1. Manager reviews submission
2. If issues found, return with feedback
3. Employee addresses feedback
4. Re-submit for review
5. Max 3 cycles before escalation
