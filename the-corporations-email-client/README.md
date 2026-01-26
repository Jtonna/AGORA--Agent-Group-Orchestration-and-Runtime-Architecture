# AGORA Email Client

A terminal-based email client (TUI) built with React and Ink for the AGORA multi-agent orchestration system.

## Features

- Dashboard view with agent hierarchy and activity feed
- Email composition with autocomplete for recipients
- Dynamic mail types loaded from `mail.xml`
- Thread-based email viewing
- Agent status tracking (active, waiting, blocked)

## Installation

```bash
npm install
npm run build
```

## Usage

```bash
npm start
```

### Keyboard Navigation

| Key | Action |
|-----|--------|
| `q` | Quit application |
| `c` | Compose new email |
| `r` | Refresh / Reply (context-dependent) |
| `b` / `Esc` | Go back |
| Arrow keys | Navigate |
| `Tab` | Move to next field / Autocomplete |
| `Enter` | Select / Send |

## Configuration

### Mail Types

Mail types (subject prefixes) are loaded dynamically from `mail.xml` at startup.

**Path Resolution Order:**
1. `MAIL_XML_PATH` environment variable
2. `../agent orchestration/agents/v3/mail.xml` (relative to working directory)
3. Fallback to built-in defaults

**Example:**
```bash
# Use custom mail.xml location
MAIL_XML_PATH=/path/to/mail.xml npm start
```

**Fallback Types:**
If `mail.xml` cannot be loaded, these defaults are used:
- GETTING STARTED, IMPORTANT, PROGRESS, COMPLETE, BLOCKED
- QUESTION, APPROVED, REVISION, ACKNOWLEDGED
- COLLABORATION REQUEST, CLARIFICATION, ANNOUNCEMENT, QUITTING

### API Server

The client connects to the AGORA mail server at `http://localhost:60061`.

Required endpoints:
- `GET /health` - Health check
- `GET /directory/agents` - List registered agents
- `GET /mail?viewer={name}` - Get inbox
- `POST /mail` - Send email

## Project Structure

```
src/
├── api/
│   └── mailbox.ts        # API client wrapper
├── components/
│   ├── App.tsx           # Main application
│   ├── Dashboard.tsx     # Dashboard view
│   ├── ComposeModal.tsx  # Email composition
│   ├── HierarchyTree.tsx # Agent hierarchy display
│   └── ...
├── hooks/
│   └── useMailbox.ts     # Data fetching hooks
├── types/
│   └── email.ts          # TypeScript types
└── utils/
    ├── mailConfig.ts     # mail.xml parser
    └── hierarchyColors.ts # Hierarchy coloring
```

## Development

```bash
# Watch mode for TypeScript compilation
npm run dev

# Build for production
npm run build
```
