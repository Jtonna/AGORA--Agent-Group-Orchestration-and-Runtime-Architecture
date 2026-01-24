# Agent Behavior Testing Report

## Test Setup

**Files under test:**
- `agent orchestration/agents/v3/agent.xml`
- `agent orchestration/agents/v3/mail.xml`
- `agent orchestration/agents/v3/lifecycle/startup.xml`

---

## Known Issues

### Issue 1: Incorrect script paths in mail.xml

**Problem:** mail.xml references scripts at `.\scripts\` but they are actually at `.\agent orchestration\scripts\`

**Status:** FIXED

---

## Test 1: Bootstrap without loading mail.xml

**Purpose:** Verify agent reads agent.xml and understands mail exists WITHOUT reading mail.xml

**Setup:**
- Renamed startup.xml temporarily
- Agent given agent.xml as instructions

**Expected:**
- Agent completes 3 bootstrap tasks from notes only
- Agent does NOT read mail.xml
- Agent enters startup phase

**Result:** PASS
- Agent understood mail from notes
- Agent did not read mail.xml during bootstrap
- Agent entered startup phase

---

## Test 2: Behavior Selection from Task Email

**Purpose:** Verify agent selects appropriate behaviors based on task content

**Setup:**
- Email sent to `jose` from `supervisor`
- Subject: `GETTING STARTED: Implement user authentication module`
- Content describes implementation task requiring planning

**Expected Agent Behavior:**
1. Startup Task 1: Load mail.xml
2. Startup Task 2: Check inbox, find GETTING STARTED email
3. Startup Task 3: Read email, understand task
4. Startup Task 4: Select behaviors:
   - `planning` - "Task is non-trivial or has multiple steps"
   - `code-writer` - "Task involves implementation"
5. Startup Task 5: Attempt to load behavior files

**Expected Behaviors NOT Selected:**
- `collaboration` - No mention of peer agents
- `delegation` - No sub-agents mentioned
- `review` - Not receiving completed work

**Result:** PASS
- Agent loaded mail.xml ✓
- Agent found and read GETTING STARTED email ✓
- Agent selected `planning` and `code-writer` ✓
- Agent did NOT select collaboration, delegation, review ✓
- Agent attempted to load behavior files (failed - files don't exist) ✓

---

## Test 3: Error Handling (QUITTING email)

**Purpose:** Verify agent sends QUITTING email when startup fails

**Setup:**
- Behavior files intentionally missing
- Agent `jose` with supervisor `juan`

**Expected:**
- Agent detects failure during startup task 5 (load behaviors)
- Agent sends QUITTING email to supervisor AND ceo
- Agent explains what failed
- Agent exits (does not proceed to runtime)

**Result:** PASS
- Agent sent QUITTING email to both `juan` AND `ceo` ✓
- Subject: `QUITTING: Missing behavior files` ✓
- Content explained: which behaviors failed to load, why, and next steps ✓

**QUITTING Email Content:**
```
I am unable to proceed with my assigned task (Implement user authentication module).
During startup task 5 (Load selected behaviors), I attempted to load the planning
and code-writer behaviors which are required for my task. However, the behavior
files do not exist at the expected location (behaviors/planning.xml,
behaviors/code-writer.xml). Without these behavior definitions, I cannot execute
the runtime phase. Please ensure behavior files are created in the behaviors/
directory, then reassign this task to a new agent instance.
```

---

## Test 4: Delegation Behavior

**Purpose:** Verify agent uses delegation behavior correctly for complex tasks

**Setup:**
1. Spawn a test agent via API ✓
2. Send GETTING STARTED email with large multi-part task ✓
3. Agent should recognize task exceeds single-agent capacity and select delegation

**Test Agent:** `george` (supervisor: `supervisor`)
**Email ID:** `10fd1f5f-4f0c-475e-8ff4-9e657a5708be`

**Task Email:**
```
To: george
From: supervisor
Subject: GETTING STARTED: Build complete e-commerce checkout system

You are assigned to build a complete checkout system including:
- Shopping cart management
- Payment processing integration
- Order confirmation emails
- Inventory updates
- Receipt generation

This is a large project requiring multiple agents. Delegate appropriately.
```

**Expected Agent Behavior:**

*Startup Phase:*
1. Load mail.xml
2. Check inbox, find GETTING STARTED
3. Read and understand task
4. Send ACKNOWLEDGED to supervisor
5. Clarify if needed (may skip if task is clear)
6. Plan approach - break into 5 sub-tasks
7. Select `delegation` behavior (task complexity exceeds one agent)
8. Load delegation.xml
9. Announce: "Managing checkout system, covering cart, payments, emails, inventory, receipts"

*Runtime Phase (delegation behavior):*
1. Verify plan exists (5 sub-tasks identified)
2. Spawn 5 sub-agents via `POST /agents/spawn`
3. Send GETTING STARTED to each sub-agent with their sub-task
4. Wait for ACKNOWLEDGED from each
5. Monitor progress (poll inbox)

**Verification Points:**
- [ ] Agent selects `delegation` behavior
- [ ] API calls: 5x `POST /agents/spawn` with `{ "supervisor": "{agent_name}" }`
- [ ] Each spawn returns `{ "agent_name": "..." }`
- [ ] GETTING STARTED emails sent to each spawned agent
- [ ] Agent enters monitoring loop waiting for responses

**How to Run:**
1. Start a new Claude session as agent `george`
2. Provide agent.xml as initial instructions with identity: `name=george, supervisor=supervisor`
3. Agent should execute startup tasks and enter runtime with delegation behavior
4. Observe API calls and emails sent

**Result:** PENDING - Ready to execute

---

## Test 5: (Future) Full Delegation + Sub-agent Flow

**Purpose:** Verify complete delegation cycle including sub-agent responses

**Status:** BLOCKED - requires sub-agents to be functional (need code-writer behavior)

**Will Test:**
- Sub-agents receive GETTING STARTED
- Sub-agents send ACKNOWLEDGED
- Sub-agents send PROGRESS updates
- Sub-agents send COMPLETE when done
- Manager sends APPROVED/REVISION
- Manager aggregates and sends COMPLETE to supervisor

---

## Notes

- Test agent names used: `test-agent`, `jose`, `george`
- Supervisor names used: `supervisor`, `juan`
- Email IDs:
  - `17fb4e24-b8c9-4536-badc-8f833efdce28` (test-agent task)
  - `cb8ccf73-fe32-4bb0-bdef-67fdb35f6d01` (jose task)
  - `088136c4-3065-45d4-a00b-ff08df97b9ae` (jose QUITTING)
  - `10fd1f5f-4f0c-475e-8ff4-9e657a5708be` (george delegation test)
