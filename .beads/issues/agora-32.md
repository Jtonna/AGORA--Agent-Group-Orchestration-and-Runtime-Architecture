# Create README Documentation

**Type:** task
**Status:** closed
**Epic:** agora-28 (Phase 4 - QA & Documentation)
**Priority:** medium
**Assignee:** Employee

## Description

Create README.md with setup and usage instructions.

## README Sections

### Project Overview
- Brief description of the email server
- Key features

### Prerequisites
- Python 3.x
- pipenv

### Installation
```bash
cd the-corporations-email
pipenv install
pipenv install --dev  # For development
```

### Running the Server
```bash
pipenv run python app.py
# Server starts on http://localhost:60061
```

### Running Tests
```bash
# All tests
pipenv run pytest

# Unit tests only
pipenv run pytest tests/unit/

# Integration tests only
pipenv run pytest tests/integration/

# Specific test file
pipenv run pytest tests/unit/test_models.py
```

### API Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/mail` | GET | Get inbox |
| `/mail/{id}` | GET | Get email + thread |
| `/mail` | POST | Send email |
| `/mail/{id}` | DELETE | Delete email |
| `/investigation/{name}` | GET | Admin view |

### Using Bruno Collection
- How to import
- How to configure environment
- Running requests

### Data Storage
- Location: `data/emails.json`
- Quarantine: `data/quarantine.json`

## Acceptance Criteria

- [ ] README covers all setup steps
- [ ] Commands are copy-paste ready
- [ ] API endpoints documented
- [ ] Testing instructions clear

## Dependencies

- **Blocked by:** agora-31 (all features must be done)

---
**Created:** 2026-01-22
