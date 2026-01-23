# AGORA - Agent Architecture Specification

## Overview

AGORA uses a **behavior-based, composable architecture** for AI agents. Agents dynamically compose their behavior from:

- **Mail** - Core communication infrastructure (always loaded)
- **Lifecycle** - Agent execution phases (startup → runtime → shutdown)
- **Behaviors** - Composable capabilities selected at runtime

An agent reads its configuration, receives a task, and **synthesizes its own behavior** by selecting appropriate behaviors for that task.

---

## Design Principles

1. **Composition over inheritance** - Agents are behavior combinations, not predefined roles
2. **Runtime adaptation** - Agents can acquire behaviors mid-execution via mail instructions
3. **Single source of truth** - Each behavior defined once, used by many agents
4. **Self-orchestration** - Agents synthesize their own execution from components
5. **Separation of concerns** - Lifecycle defines WHEN, behaviors define WHAT

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         AGENT                               │
│   BOOTSTRAP: read agent.xml → STARTUP: load mail, get task  │
│   → select behaviors → RUNTIME: execute → SHUTDOWN: done    │
└─────────────────────────────────────────────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐    ┌───────────────┐    ┌───────────────┐
│   MAIL.XML    │    │  LIFECYCLE/   │    │  BEHAVIORS/   │
│   (always)    │    │   (phases)    │    │ (selectable)  │
└───────────────┘    └───────────────┘    └───────────────┘
        │                    │                     │
   Core infra          startup.xml         code-writer.xml
   for agent           runtime.xml         collaboration.xml
   communication       shutdown.xml          delegation.xml
                                           review.xml
                                           planning.xml
```

---

## File Structure

```
v3/
├── README.md           # This specification
├── agent.xml           # Bootstrap: mail info, lifecycle refs, behavior catalog
├── mail.xml            # CORE INFRASTRUCTURE (always loaded)
├── lifecycle/          # Agent execution phases
│   ├── startup.xml     # FIXED: Initialization
│   ├── runtime.xml     # MODIFIABLE: Behaviors inject here
│   └── shutdown.xml      # FIXED: Completion
└── behaviors/          # Composable capabilities
    ├── code-writer.xml
    ├── collaboration.xml
    ├── delegation.xml
    ├── review.xml
    └── planning.xml
```

---

## Agent Bootstrap (agent.xml)

The agent.xml file is the first thing an agent reads - it bootstraps the agent with core knowledge:

- **Mail exists** - Communication guidelines and protocol reference
- **Lifecycle phases** - References to startup.xml, runtime.xml, shutdown.xml
- **Behavior catalog** - Names and descriptions of available behaviors

The agent reads agent.xml, learns what resources are available, then enters the startup.xml workflow to begin execution.

---

## Mail (Core Infrastructure)

Mail is the foundation of agent coordination. It is **always loaded** - not a selectable behavior.

### Purpose

- **Agent-to-agent communication** - Agents send tasks, updates, and responses to each other
- **Status updates** - Agents report progress to supervisors
- **Peer coordination** - Agents align on specs and collaborate during development
- **Human-in-the-loop** - Humans can participate in the communication flow (optional)

### Why Mail is Core

Every lifecycle phase involves communication:
- Startup: Receive task assignment
- Runtime: Report progress, ask questions, coordinate with peers
- Shutdown: Report completion, receive approval

Every behavior assumes mail exists. Delegation sends task assignments. Collaboration sends coordination requests. Review sends approval/revision responses.

An agent that doesn't communicate is an agent that can't coordinate. Mail is not optional.

*Protocol details (subject prefixes, endpoints, rules) are defined in mail.xml.*

---

## Lifecycle

The agent lifecycle has three phases. Two are **fixed** (predefined workflows), one is **modifiable** (behaviors inject here).

### startup.xml (FIXED)

Agent initialization and task receipt. This workflow is predefined and cannot be modified by behaviors. (Agent has already read agent.xml before entering this phase.)

- Load mail.xml (communication protocol)
- Read inbox for task assignment
- Determine tasks from mail
- Select behaviors from catalog (in agent.xml)
- Load full definitions for selected behaviors
- Acknowledge receipt

### runtime.xml (MODIFIABLE)

Active work execution. This is where **behaviors inject and modify execution**.

The agent:
1. Enters runtime with selected behaviors
2. Synthesizes HOW to execute based on active behaviors
3. Determines order and interaction of behavior capabilities
4. Adapts as new behaviors are acquired mid-execution

Two agents with different behaviors will execute differently within the same runtime structure.

### shutdown.xml (FIXED)

Completion and cleanup. This workflow is predefined and cannot be modified by behaviors.

- Verify work completion
- Report results to supervisor
- Handle approval/revision cycle
- Clean up resources

---

## Behaviors

Behaviors are composable capabilities that modify agent execution during the runtime phase.

During startup, the agent reviews the **behavior catalog** (name + description only) to decide which behaviors to load. Only selected behaviors have their full definitions loaded - this keeps the agent lightweight.

| Behavior | Purpose | Selected When |
|----------|---------|---------------|
| **code-writer** | Write, edit, implement code | Task involves implementation |
| **collaboration** | Coordinate with peer agents | Working with others on related work |
| **delegation** | Assign work, track reports | Agent has sub-agents or team |
| **review** | Evaluate work quality | Receives completed work from others |
| **planning** | Break down complex tasks | Task is non-trivial or has multiple steps |

### Behavior Properties

- **Independent** - Behaviors don't know about each other
- **Composable** - Multiple behaviors can be active simultaneously
- **Dynamic** - Behaviors can be added mid-execution
- **Synthesized** - Agent decides how behaviors work together

### Behavior Combinations

- **delegation + code-writer**: Delegate some work, implement other parts directly
- **collaboration + code-writer**: Coordinate with peers on shared implementation
- **planning + delegation + review**: Break down work, delegate it, review results

---

## Compilation Model

When an agent starts, it reads agent.xml first (bootstrap), then executes the lifecycle phases:

```
BOOTSTRAP:
  0. Read agent.xml
     └── Learn: mail exists, lifecycle files, behavior catalog

STARTUP (fixed):
  1. Load mail.xml (communication protocol)
  2. Read inbox → receive task assignment
  3. Review behavior catalog (from agent.xml)
  4. Select behaviors needed for task
  5. Load full definitions for selected behaviors

RUNTIME (modifiable):
  6. Execute with loaded behaviors
     └── Agent synthesizes execution from selected behaviors

SHUTDOWN (fixed):
  7. Report completion, cleanup
```

The agent only loads full behavior definitions for behaviors it actually needs - it doesn't load all behavior files upfront.

### Dynamic Updates

During runtime, behaviors can be added:

```
Supervisor → Agent-A: "Use collaboration behavior with Agent-B"

Agent-A loads collaboration behavior
Agent-A re-synthesizes execution with new capability
Agent-A coordinates with Agent-B
```

---

## Examples

Behaviors compile into agent configurations. There are no predefined "manager" or "engineer" agents - just behavior combinations.

| Configuration | Behaviors | Resulting Capability |
|---------------|-----------|---------------------|
| Coordinator | delegation + planning | Routes tasks, monitors progress |
| Lead | delegation + planning + review | Breaks down work, delegates, reviews |
| Implementer | code-writer + collaboration | Writes code, coordinates with peers |
| Solo | code-writer + planning | Plans and implements independently |

These are examples, not fixed roles. An "implementer" can acquire delegation if given a sub-agent. A "coordinator" can acquire code-writer if needed. Agents adapt to their tasks.

---

## Next Steps

1. **agent.xml** - Core agent with behavior catalog and selection heuristics
2. **mail.xml** - Communication infrastructure and protocols
3. **lifecycle/** - Startup, runtime, shutdown phase definitions
4. **behaviors/** - Individual behavior definitions
