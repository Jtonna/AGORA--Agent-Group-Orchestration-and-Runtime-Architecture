# V3 Agent Architecture - Implementation TODOs

## Server-Side Requirements

### 1. Spawn API

**Endpoint:** `POST http://localhost:60061/agents/spawn`

**Purpose:** Create a new agent instance that can receive mail and execute tasks.

**Request:**
```json
{
  "supervisor": "agent-name"
}
```

**Response:**
```json
{
  "agent_name": "agent-x7k9m",
  "status": "ready"
}
```

**Behavior:**
- Generate a random unique agent name (e.g., `agent-x7k9m`)
- Create inbox for the new agent so it can receive mail
- The supervisor then sends GETTING STARTED to assign the task

**Used by:** `behaviors/delegation.xml` (spawn phase)

---

### 2. "everyone" Mail Recipient

**Purpose:** Broadcast messages to all active agents for peer discovery.

**Behavior:**
- When an email is sent to recipient `everyone`, the mail server distributes copies to all known inboxes
- Used for ANNOUNCEMENT emails so agents can discover collaboration opportunities

**Example:**
```
From: agent-frontend
To: everyone
Subject: ANNOUNCEMENT: Working on login UI - integrating with auth API

This helps backend agents know to reach out for API contract alignment.
```

**Used by:** `behaviors/delegation.xml` (announce phase), `mail.xml` (ANNOUNCEMENT type)

---

## Status

| TODO | Status | Notes |
|------|--------|-------|
| Spawn API | Not started | Required for delegation behavior |
| everyone recipient | Not started | Required for peer discovery |
