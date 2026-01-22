# Flask App Setup with Middleware

**Type:** task
**Status:** open
**Epic:** agora-17 (Phase 3 - API Layer)
**Priority:** critical
**Assignee:** Employee

## Description

Set up the Flask application with CORS, request logging middleware, and global error handling.

## Flask App Configuration

```python
from flask import Flask
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Allow all origins
```

## Server Configuration

- **Port:** 60061
- **CORS:** Unrestricted (all origins allowed)

## Transaction ID Middleware

Generate unique 8-character hex ID for each request.

```python
import secrets

@app.before_request
def assign_transaction_id():
    g.transaction_id = secrets.token_hex(4)  # 8 hex chars
```

## Logging Middleware

Log format:
```
[{timestamp}] [{transaction_id}] [{level}] {message}
```

```python
@app.before_request
def log_request():
    log_info(f"REQUEST: {request.method} {request.path}")
    if request.data:
        log_info(f"BODY: {request.get_data(as_text=True)}")

@app.after_request
def log_response(response):
    log_info(f"RESPONSE: {response.status_code} {response.get_data(as_text=True)}")
    return response
```

## Global Request Validation

Before any endpoint logic:

1. Check for unknown query parameters
2. Check for duplicate query parameters
3. For POST: Check Content-Type header
4. For POST: Validate JSON body
5. For POST: Check for unknown fields

```python
def validate_query_params(allowed: List[str]):
    for key in request.args.keys():
        if key not in allowed:
            raise AppError('UNKNOWN_PARAMETER', ...)
    # Check for duplicates
    for key in request.args.keys():
        if len(request.args.getlist(key)) > 1:
            raise AppError('DUPLICATE_PARAMETER', ...)
```

## Global Error Handler

```python
@app.errorhandler(AppError)
def handle_app_error(error):
    log_error(f"Error: {error.code} - {error.message}")
    return {"error": error.message, "code": error.code}, error.status_code
```

## Acceptance Criteria

- [ ] Flask app starts on port 60061
- [ ] CORS allows all origins
- [ ] Transaction ID generated per request
- [ ] All requests/responses logged with transaction ID
- [ ] Global error handler catches AppError
- [ ] Query param validation works globally

## Dependencies

- **Blocked by:** agora-16 (needs services layer complete)

---
**Created:** 2026-01-22
