# AGORA -- Agent Group Orchestration and Runtime Architecture

**`agora-framework`** | Node.js >= 20 | ESM

AGORA is an npm package that provides a complete agent orchestration system. It combines three core components into a single CLI-driven workflow:

- **Email Server** -- A Fastify-based REST API that gives agents a shared communication bus. Agents send and receive structured emails, form threads, and broadcast to groups.
- **Agent Framework** -- XML-based configuration files that define agent identity, lifecycle phases, and composable behaviors. Agents self-orchestrate by selecting capabilities at runtime.
- **TUI Dashboard** -- A terminal UI built with React and Ink that provides a real-time view of all agent activity, inboxes, hierarchy, and email composition.

---

## Architecture

```
                         ┌──────────────────────────┐
                         │        agora CLI          │
                         │   (Commander.js)          │
                         │                           │
                         │  init | start | stop      │
                         │  status | mail            │
                         └─────────────┬────────────┘
                                       │
                 ┌─────────────────────┼─────────────────────┐
                 │                     │                     │
                 ▼                     ▼                     ▼
      ┌───────────────────┐ ┌───────────────────┐ ┌───────────────────┐
      │   Email Server    │ │  Agent Framework  │ │    TUI Client     │
      │   (Fastify)       │ │  (XML configs)    │ │    (React + Ink)  │
      │                   │ │                   │ │                   │
      │  REST API on      │ │  .agora/agents/   │ │  Orchestration    │
      │  :60061           │ │  agent.xml        │ │  Dashboard        │
      │                   │ │  mail.xml         │ │                   │
      │  /mail            │ │  lifecycle/       │ │  Agent cards      │
      │  /mail/:mailId    │ │  behaviors/       │ │  Activity feed    │
      │  /directory/agents│ │                   │ │  Hierarchy tree   │
      │  /agents/spawn    │ │  Identity         │ │  Compose modal    │
      │  /investigation   │ │  Lifecycle        │ │  Email detail     │
      │  /health          │ │  Behaviors        │ │                   │
      └────────┬──────────┘ └────────┬──────────┘ └────────┬──────────┘
               │                     │                     │
               └─────────────────────┴─────────────────────┘
                                     │
                              .agora/data/
                            emails.json
                            quarantine.json
```

The server persists all email data to JSON files in `.agora/data/`. The TUI client connects to the server over HTTP. Agents interact with the server through the same REST API. The agent framework XML files are read directly by agent processes at spawn time.

---

## Quick Start

```bash
# 1. Install
npm install agora-framework

# 2. Scaffold the project directory
npx agora init

# 3. Start the email server
npx agora start

# 4. Open the TUI dashboard (in another terminal)
npx agora mail
```

After `agora init`, you will have a `.agora/` directory in your project with all the configuration files and data storage needed to run the system.

---

## CLI Reference

The CLI is built with Commander.js and exposes five commands:

| Command        | Description                         | Flags                                                                 |
| -------------- | ----------------------------------- | --------------------------------------------------------------------- |
| `agora init`   | Scaffold a `.agora/` folder in cwd  | `--force` -- overwrite existing `.agora/` directory                   |
| `agora start`  | Start the AGORA email server        | `-p, --port <number>` (default: `60061`), `-d, --detach` (background), `--data-dir <path>` |
| `agora stop`   | Stop a detached AGORA server        | (none)                                                                |
| `agora status` | Check server health                 | `-p, --port <number>` (default: `60061`)                              |
| `agora mail`   | Launch the email client TUI         | `-p, --port <number>`                                                 |

### Command Details

**`agora init`**
Copies the scaffold templates into `.agora/` in the current working directory. Creates `config.json`, the `agents/` directory tree with XML configuration files, helper shell scripts in `scripts/`, and an empty `data/` directory with initialized `emails.json` and `quarantine.json` files.

**`agora start`**
Starts the Fastify email server. In foreground mode (default), the server runs in the current process. With `--detach`, it spawns a background process and writes its PID to `.agora/.server.pid`. The server reads its data directory from `--data-dir`, then `.agora/config.json`, and falls back to `.agora/data/`.

**`agora stop`**
Reads the PID from `.agora/.server.pid` and sends SIGTERM to the detached server process.

**`agora status`**
Hits `GET /health` on the configured port and reports whether the server is running.

**`agora mail`**
Spawns the Ink-based TUI client as a child process with inherited stdio. Sets `AGORA_API_URL` from the port in `.agora/config.json` (or the `--port` flag). The TUI reads `mail.xml` to load email type prefixes for the compose modal.

---

## Package Structure

```
agora/
├── src/
│   ├── cli/                    # CLI entry point and commands
│   │   ├── index.ts            # Commander program definition
│   │   └── commands/
│   │       ├── init.ts         # Scaffold .agora/ directory
│   │       ├── start.ts        # Start email server (foreground/detach)
│   │       ├── stop.ts         # Stop detached server via PID file
│   │       ├── status.ts       # Health check against running server
│   │       └── mail.ts         # Launch TUI client process
│   │
│   ├── server/                 # Fastify email server (ported from Python)
│   │   ├── app.ts              # Server factory (buildApp, startServer)
│   │   ├── models.ts           # Email class, validation, UUID/timestamp utils
│   │   ├── services.ts         # Business logic (inbox, threads, pagination)
│   │   ├── storage.ts          # JSON file persistence (EmailStorage singleton)
│   │   ├── errors.ts           # AppError class and error codes
│   │   ├── routes/
│   │   │   ├── health.ts       # GET /health
│   │   │   ├── mail.ts         # GET /mail (inbox), POST /mail (send)
│   │   │   ├── mailDetail.ts   # GET /mail/:mailId, DELETE /mail/:mailId
│   │   │   ├── investigation.ts# GET /investigation/:name
│   │   │   └── agents.ts       # GET /directory/agents, POST /agents/spawn
│   │   └── middleware/
│   │       ├── transactionId.ts# X-Transaction-Id header injection
│   │       ├── logging.ts      # Request/response logging
│   │       └── validation.ts   # Query param, body, and content-type checks
│   │
│   ├── client/                 # TUI email dashboard (React + Ink)
│   │   ├── index.tsx           # Entry point -- loads mail config, renders App
│   │   ├── App.tsx             # Root component, view routing, keyboard input
│   │   ├── api/
│   │   │   └── mailbox.ts      # HTTP client for server API
│   │   ├── components/
│   │   │   ├── Dashboard.tsx   # Main dashboard layout (hierarchy + cards + feed)
│   │   │   ├── AgentCard.tsx   # Individual agent summary card
│   │   │   ├── AgentListView.tsx# Full agent list (scrollable)
│   │   │   ├── HierarchyTree.tsx# Supervisor/report tree visualization
│   │   │   ├── ActivityFeed.tsx# Real-time email activity stream
│   │   │   ├── EmailDetail.tsx # Single email view with thread
│   │   │   ├── ThreadView.tsx  # Conversation thread display
│   │   │   ├── ComposeModal.tsx# Email composition form
│   │   │   ├── AutocompleteInput.tsx # Agent name autocomplete
│   │   │   └── StatusBar.tsx   # Bottom bar (connection, refresh, shortcuts)
│   │   ├── hooks/
│   │   │   └── useMailbox.ts   # Polling hook for agents, stats, and activity
│   │   ├── types/
│   │   │   └── email.ts        # TypeScript interfaces for email and views
│   │   └── utils/
│   │       ├── mailConfig.ts   # Parse mail.xml for email type prefixes
│   │       ├── hierarchyColors.ts # Color assignment by hierarchy depth
│   │       ├── settings.ts     # Persistent user settings (sound, etc.)
│   │       └── sound.ts        # Notification sound playback
│   │
│
├── scaffold/                   # Template files copied by `agora init`
│   ├── config.json             # Default configuration (port, dataDir)
│   ├── agents/
│   │   ├── agent.xml           # Root agent configuration template
│   │   ├── mail.xml            # Email type definitions and protocols
│   │   ├── lifecycle/
│   │   │   └── startup.xml     # Startup phase instructions
│   │   └── behaviors/
│   │       └── delegation.xml  # Delegation behavior definition
│   └── scripts/
│       ├── check-mail.sh       # Shell script: check inbox via curl
│       ├── check-mail.ps1      # PowerShell: check inbox
│       ├── send-mail.sh        # Shell script: send email via curl
│       └── send-mail.ps1       # PowerShell: send email
├── assets/
│   └── notification.mp3        # Email notification sound
│
├── tests/
│   ├── unit/
│   │   └── models.test.ts     # Email model unit tests
│   └── integration/
│       └── endpoints.test.ts  # Full API endpoint integration tests
│
├── docs/
│   ├── Email-System-Spec.md       # Complete email server specification
│   ├── Agent-Orchestration-Spec.md# Agent architecture specification
│   └── Agent-Orchestration-TODOs.md# Implementation roadmap
│
├── dist/                       # Compiled output (tsc)
└── package.json
```

---

## The .agora/ Directory

Running `agora init` creates the following structure in your project root:

```
.agora/
├── config.json              # Server configuration
├── agents/
│   ├── agent.xml            # Agent identity, tasks, lifecycle, behaviors
│   ├── mail.xml             # Email type definitions and communication protocols
│   ├── lifecycle/
│   │   └── startup.xml      # Startup phase instructions
│   └── behaviors/
│       └── delegation.xml   # Delegation behavior definition
├── scripts/
│   ├── check-mail.sh        # Convenience script: check inbox (bash)
│   ├── check-mail.ps1       # Convenience script: check inbox (PowerShell)
│   ├── send-mail.sh         # Convenience script: send email (bash)
│   └── send-mail.ps1        # Convenience script: send email (PowerShell)
└── data/
    ├── emails.json           # Email storage (version 1 format)
    └── quarantine.json       # Quarantined invalid emails
```

### config.json

```json
{
  "port": 60061,
  "dataDir": ".agora/data"
}
```

The `port` value is read by both `agora start` and `agora mail` when no `--port` flag is provided. The `dataDir` path is relative to cwd and tells the server where to read and write `emails.json` and `quarantine.json`.

### agents/agent.xml

The root configuration template for spawned agents. Contains placeholder tokens (`{agent_name}`, `{supervisor}`) that are filled at spawn time. Defines:

- **Identity** -- agent name and supervisor assignment
- **Tasks** -- ordered bootstrap tasks the agent completes before entering its lifecycle
- **Mail** -- reference to `mail.xml` for communication protocols
- **Lifecycle** -- three phases: `startup` (fixed), `runtime` (modifiable), `shutdown` (fixed)
- **Behaviors** -- selectable capabilities: `code-writer`, `collaboration`, `delegation`, `review`, `planning`

### data/emails.json

Versioned JSON file. Structure:

```json
{
  "version": 1,
  "emails": [
    {
      "id": "uuid",
      "to": ["recipient1", "recipient2"],
      "from": "sender",
      "subject": "Subject line",
      "content": "Email body",
      "timestamp": "2024-01-15T10:30:00Z",
      "isResponseTo": null,
      "readBy": [],
      "deletedBy": []
    }
  ]
}
```

On server startup, the storage layer validates every email in the file. Emails with invalid fields, duplicate IDs, or malformed data are moved to `quarantine.json` rather than silently dropped.

---

## How Agents Use the System

The full agent lifecycle:

1. **Spawn** -- A supervisor (or the system) sends `POST /agents/spawn` to register a new agent. The server generates a unique name from a dictionary and returns it.

2. **Bootstrap** -- The agent process reads `agent.xml`, which contains its identity (name, supervisor) and an ordered list of bootstrap tasks: understand the mail system, understand lifecycle phases, review the behavior catalog.

3. **Startup** -- The agent enters the `startup` lifecycle phase (defined in `lifecycle/startup.xml`). It checks mail, receives its task assignment (typically a "GETTING STARTED" email from its supervisor), asks clarifying questions if needed, plans its approach, and selects the behaviors it will use.

4. **Runtime** -- The agent enters the `runtime` phase. Selected behaviors (code-writer, collaboration, delegation, review, planning) inject their logic here. The agent does its work, communicating with other agents and its supervisor through the email server.

5. **Shutdown** -- The agent enters the `shutdown` phase, sends a "COMPLETE" email to its supervisor with results, and exits.

Throughout all phases, agents communicate exclusively through the email server using typed messages (GETTING STARTED, PROGRESS, COMPLETE, BLOCKED, COLLABORATION REQUEST, etc.). The TUI dashboard displays all of this activity in real time.

---

## API Endpoints

All endpoints are served by the Fastify server on the configured port (default `60061`). Content type is `application/json; charset=utf-8`.

| Method   | Endpoint                 | Description                                      |
| -------- | ------------------------ | ------------------------------------------------ |
| `GET`    | `/health`                | Health check. Returns `{ "status": "ok" }`.      |
| `GET`    | `/mail`                  | Paginated inbox for a viewer.                    |
| `POST`   | `/mail`                  | Send a new email.                                |
| `GET`    | `/mail/:mailId`          | Email detail with paginated thread.              |
| `DELETE` | `/mail/:mailId`          | Soft-delete an email for a viewer.               |
| `GET`    | `/investigation/:name`   | All emails for a person (including deleted).      |
| `GET`    | `/directory/agents`      | List all registered agents.                      |
| `POST`   | `/agents/spawn`          | Spawn a new agent with auto-generated name.      |

### Key Query Parameters

- `viewer` (string) -- Required on `GET /mail`, `GET /mail/:mailId`, `DELETE /mail/:mailId`. Identifies who is viewing. Case-insensitive.
- `page` (integer) -- Pagination for `GET /mail`, `GET /investigation/:name`. Defaults to 1.
- `thread_page` (integer) -- Thread pagination for `GET /mail/:mailId`. Defaults to 1.

### POST /mail Body

```json
{
  "to": ["recipient1", "recipient2"],
  "from": "sender_name",
  "subject": "Subject line",
  "content": "Email body text",
  "isResponseTo": "uuid-of-parent-email-or-null"
}
```

Sending to `"everyone"` in the `to` array broadcasts the email to all registered agents (excluding the sender). Replies automatically get "Re: " prefixed to the subject if not already present.

### POST /agents/spawn Body

```json
{
  "supervisor": "supervisor_name"
}
```

The body is optional. If provided, the new agent is registered under the given supervisor. The response returns `{ "agent_name": "generated-name" }`.

For the complete API specification, see [docs/Email-System-Spec.md](https://github.com/Jtonna/AGORA--Agent-Group-Orchestration-and-Runtime-Architecture/blob/main/agora/docs/Email-System-Spec.md).

---

## Configuration

### .agora/config.json

| Field     | Type   | Default         | Description                          |
| --------- | ------ | --------------- | ------------------------------------ |
| `port`    | number | `60061`         | Port the email server listens on     |
| `dataDir` | string | `".agora/data"` | Path to email data directory (relative to cwd) |

### Environment Variables

| Variable        | Used By    | Description                                                    |
| --------------- | ---------- | -------------------------------------------------------------- |
| `AGORA_API_URL` | TUI Client | Full base URL for the email server (e.g., `http://localhost:60061`). Set automatically by `agora mail`. |
| `MAIL_XML_PATH` | TUI Client | Absolute path to `mail.xml`. If set, the TUI reads email type prefixes from this file instead of searching default paths. |

### Server Options (Programmatic)

When using `buildApp()` or `startServer()` directly from code:

```typescript
import { startServer } from 'agora-framework';

await startServer({
  port: 60061,      // default: 60061
  host: '0.0.0.0',  // default: '0.0.0.0'
  dataDir: './data', // default: 'data'
  logger: false,     // default: false (Fastify logger)
});
```

---

## Development

### Build and Test

```bash
# Build TypeScript to dist/
npm run build

# Watch mode (rebuild on change)
npm run dev

# Run all tests
npm run test

# Watch mode for tests
npm run test:watch
```

### Test Suite

Tests use Vitest. The suite includes unit tests for the Email model and validation functions, and integration tests that spin up the full Fastify server and exercise every endpoint.

```
tests/
├── unit/
│   └── models.test.ts        # Email class, normalization, validation
└── integration/
    └── endpoints.test.ts     # Full HTTP endpoint coverage
```

### Dependencies

Runtime:

| Package                   | Purpose                           |
| ------------------------- | --------------------------------- |
| `fastify`                 | HTTP server framework             |
| `@fastify/cors`           | CORS middleware                   |
| `commander`               | CLI argument parsing              |
| `uuid`                    | UUID generation and validation    |
| `unique-names-generator`  | Random agent name generation      |
| `ink`                     | React-based terminal UI framework |
| `ink-spinner`             | Loading spinners for TUI          |
| `ink-text-input`          | Text input components for TUI     |
| `react`                   | UI component model                |

Dev:

| Package       | Purpose            |
| ------------- | ------------------ |
| `typescript`  | Type checking, compilation |
| `vitest`      | Test runner        |
| `@types/node` | Node.js type definitions |
| `@types/react`| React type definitions |
| `@types/uuid` | UUID type definitions |

---

## Related Documentation

- **[docs/Email-System-Spec.md](https://github.com/Jtonna/AGORA--Agent-Group-Orchestration-and-Runtime-Architecture/blob/main/agora/docs/Email-System-Spec.md)** -- Complete specification for the email server: data model, all endpoints with request/response formats, error codes, pagination behavior, and storage validation rules.
- **[docs/Agent-Orchestration-Spec.md](https://github.com/Jtonna/AGORA--Agent-Group-Orchestration-and-Runtime-Architecture/blob/main/agora/docs/Agent-Orchestration-Spec.md)** -- Agent architecture specification: design principles, XML configuration format, lifecycle phases, behavior system, and the mail communication protocol.
- **[docs/Agent-Orchestration-TODOs.md](https://github.com/Jtonna/AGORA--Agent-Group-Orchestration-and-Runtime-Architecture/blob/main/agora/docs/Agent-Orchestration-TODOs.md)** -- Implementation roadmap and outstanding work items.
- **[docs/Release.md](https://github.com/Jtonna/AGORA--Agent-Group-Orchestration-and-Runtime-Architecture/blob/main/agora/docs/Release.md)** -- Release process, versioning strategy, and npm publish workflow.
