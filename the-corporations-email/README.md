# The Corporation's Email Server

A Python Flask email server API for managing email communications within an organization.

## Requirements

- Python 3.11+
- pipenv

## Setup Instructions

```bash
cd the-corporations-email
pipenv install
pipenv shell
```

## Running the Server

```bash
python app.py
# Server runs on http://localhost:60061
```

The server will start with CORS enabled and transaction ID logging for all requests.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check - returns `{"status": "ok"}` |
| GET | `/mail` | Get inbox for a viewer (paginated) |
| GET | `/mail/{id}` | Get email detail with thread |
| POST | `/mail` | Send a new email |
| DELETE | `/mail/{id}` | Soft-delete an email for a viewer |
| GET | `/investigation/{name}` | Get all emails for a person (investigation mode) |

### Query Parameters

**GET /mail**
- `viewer` (required): Name of user viewing inbox
- `page` (optional): Page number (default: 1)

**GET /mail/{id}**
- `viewer` (required): Name of user viewing email
- `thread_page` (optional): Page number for thread (default: 1)

**DELETE /mail/{id}**
- `viewer` (required): Name of user deleting the email

**GET /investigation/{name}**
- `page` (optional): Page number (default: 1)

### POST /mail Request Body

```json
{
  "to": ["alice", "bob"],
  "from": "charlie",
  "subject": "Meeting Tomorrow",
  "content": "Let's meet at 10am.",
  "isResponseTo": "optional-uuid-of-parent-email"
}
```

**Required headers:**
- `Content-Type: application/json; charset=utf-8`

## Running Tests

Run all tests:
```bash
pytest
```

Run only unit tests:
```bash
pytest tests/unit/
```

Run only integration tests:
```bash
pytest tests/integration/
```

Run with verbose output:
```bash
pytest -v
```

## Bruno Collection

The project includes a [Bruno](https://www.usebruno.com/) API collection for manual testing.

### Importing the Collection

1. Open Bruno
2. Click "Import Collection"
3. Navigate to `the-corporations-email/bruno/the-corporations-email/`
4. Select the folder to import

### Using the Collection

1. Select the "local" environment from the environment dropdown
2. The following variables are pre-configured:
   - `base_url`: `http://localhost:60061`
   - `viewer`: `alice`
   - `email_id`: `00000000-0000-0000-0000-000000000001`
   - `name`: `alice`
3. Start the server (`python app.py`)
4. Run requests from the collection

### Available Requests

- **health.bru** - Health check endpoint
- **mail/get-inbox.bru** - Get paginated inbox
- **mail/get-email.bru** - Get email with thread
- **mail/send-email.bru** - Send a new email
- **mail/delete-email.bru** - Delete an email
- **investigation/get-investigation.bru** - Get all emails for a person

## Project Structure

```
the-corporations-email/
├── app.py                  # Flask application with routes
├── models.py               # Email model and validation
├── services.py             # Business logic and pagination
├── storage.py              # JSON file storage layer
├── errors.py               # Error codes and messages
├── Pipfile                 # Python dependencies
├── data/                   # Email storage directory
├── tests/
│   ├── conftest.py         # Test fixtures
│   ├── unit/
│   │   ├── test_models.py
│   │   ├── test_services.py
│   │   └── test_storage.py
│   └── integration/
│       ├── test_endpoints.py
│       ├── test_pagination.py
│       └── test_thread_chains.py
└── bruno/
    └── the-corporations-email/
        ├── bruno.json
        ├── environments/
        │   └── local.bru
        ├── health.bru
        ├── mail/
        │   ├── get-inbox.bru
        │   ├── get-email.bru
        │   ├── send-email.bru
        │   └── delete-email.bru
        └── investigation/
            └── get-investigation.bru
```

## Architecture

- **Flask**: Web framework with CORS support
- **JSON Storage**: File-based persistence in `data/` directory
- **Transaction IDs**: 8-character hex IDs for request tracing
- **Soft Deletes**: Emails are soft-deleted per user (deletedBy tracking)
- **Read Tracking**: Per-user read status (readBy tracking)
- **Threading**: Emails can reference parent emails via `isResponseTo`
