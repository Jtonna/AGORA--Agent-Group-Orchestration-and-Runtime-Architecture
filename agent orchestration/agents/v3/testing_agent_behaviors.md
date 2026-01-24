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

## Test 4: (Future) Behavior File Loading

**Purpose:** Verify agent loads correct behavior files and uses them in runtime

**Status:** BLOCKED - behavior files not yet created

---

## Test 5: (Future) Full Startup to Runtime Flow

**Purpose:** Verify agent completes startup and enters runtime with loaded behaviors

**Status:** BLOCKED - behavior files not yet created

---

## Notes

- Test agent names used: `test-agent`, `jose`
- Supervisor names used: `supervisor`, `juan`
- Email IDs:
  - `17fb4e24-b8c9-4536-badc-8f833efdce28` (test-agent task)
  - `cb8ccf73-fe32-4bb0-bdef-67fdb35f6d01` (jose task)
  - `088136c4-3065-45d4-a00b-ff08df97b9ae` (jose QUITTING)
