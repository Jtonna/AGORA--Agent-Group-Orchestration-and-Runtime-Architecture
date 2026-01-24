"""
Flask application for the-corporations-email server.

This module provides:
- Flask app with CORS enabled
- Transaction ID middleware for request tracing
- Request/response logging
- Global error handling
- Query parameter validation helpers
"""

import secrets
import sys
from datetime import datetime, timezone
from functools import wraps
from typing import List, Optional, Tuple, Any, Dict

from flask import Flask, g, request, jsonify, Response
from flask_cors import CORS

from models import (
    Email, normalize_name, validate_uuid, generate_uuid, generate_timestamp,
    check_unknown_fields, ALLOWED_EMAIL_FIELDS
)
from storage import get_storage
from services import (
    get_inbox_for_viewer, build_thread, mark_as_read, mark_as_deleted,
    paginate_inbox, paginate_thread, paginate_investigation, get_read_status,
    validate_page_number, PaginationError, PAGE_SIZE_INVESTIGATION,
    get_all_known_agents
)
from errors import (
    EMAIL_NOT_FOUND, EMAIL_DELETED, NOT_PARTICIPANT, PARENT_NOT_FOUND,
    MISSING_FIELD, INVALID_FIELD, INVALID_JSON, INVALID_UUID, INVALID_PAGE,
    INVALID_NAME, MISSING_VIEWER, INVALID_VIEWER, UNKNOWN_PARAMETER,
    DUPLICATE_PARAMETER, UNKNOWN_FIELD, UNSUPPORTED_MEDIA_TYPE,
    NAME_TAKEN, AGENT_NOT_FOUND,
    ERROR_STATUS_CODES
)


# =============================================================================
# Flask App Configuration
# =============================================================================

app = Flask(__name__)
CORS(app)  # Allow all origins


# =============================================================================
# Custom Exception for Application Errors
# =============================================================================

class AppError(Exception):
    """Application-level error with code and HTTP status."""

    def __init__(self, code: str, message: str, status_code: Optional[int] = None):
        self.code = code
        self.message = message
        self.status_code = status_code or ERROR_STATUS_CODES.get(code, 400)
        super().__init__(message)


# =============================================================================
# Logging Helpers
# =============================================================================

def get_timestamp() -> str:
    """Get current timestamp in ISO 8601 format."""
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log_message(level: str, message: str) -> None:
    """
    Log a message with transaction ID and timestamp.

    Format: [{timestamp}] [{transaction_id}] [{level}] {message}
    """
    transaction_id = getattr(g, 'transaction_id', '--------')
    timestamp = get_timestamp()
    print(f"[{timestamp}] [{transaction_id}] [{level}] {message}", file=sys.stdout, flush=True)


def log_info(message: str) -> None:
    """Log an info message."""
    log_message("INFO", message)


def log_error(message: str) -> None:
    """Log an error message."""
    log_message("ERROR", message)


def log_debug(message: str) -> None:
    """Log a debug message."""
    log_message("DEBUG", message)


# =============================================================================
# Request Middleware
# =============================================================================

@app.before_request
def assign_transaction_id():
    """Generate unique 8-character hex transaction ID for each request."""
    g.transaction_id = secrets.token_hex(4)


@app.before_request
def log_request():
    """Log incoming request details."""
    log_info(f"REQUEST: {request.method} {request.path}")
    if request.query_string:
        log_info(f"QUERY: {request.query_string.decode('utf-8')}")
    if request.data:
        log_info(f"BODY: {request.get_data(as_text=True)}")


@app.after_request
def log_response(response: Response) -> Response:
    """Log response details."""
    # Truncate very long responses for logging
    response_data = response.get_data(as_text=True)
    if len(response_data) > 1000:
        response_data = response_data[:1000] + "...[truncated]"
    log_info(f"RESPONSE: {response.status_code} {response_data}")
    return response


@app.after_request
def set_content_type(response: Response) -> Response:
    """Ensure all responses have correct Content-Type."""
    if response.content_type == 'application/json':
        response.content_type = 'application/json; charset=utf-8'
    return response


# =============================================================================
# Global Error Handler
# =============================================================================

@app.errorhandler(AppError)
def handle_app_error(error: AppError):
    """Handle application errors and return JSON response."""
    log_error(f"AppError: {error.code} - {error.message}")
    return jsonify({"error": error.message, "code": error.code}), error.status_code


@app.errorhandler(Exception)
def handle_generic_error(error: Exception):
    """Handle unexpected errors."""
    log_error(f"Unexpected error: {type(error).__name__} - {str(error)}")
    return jsonify({"error": "Internal server error", "code": "INTERNAL_ERROR"}), 500


# =============================================================================
# Query Parameter Validation Helpers
# =============================================================================

def validate_query_params(allowed: List[str]) -> None:
    """
    Validate query parameters against allowed list.

    Checks for:
    1. Unknown parameters (not in allowed list)
    2. Duplicate parameters (same key multiple times)

    Args:
        allowed: List of allowed query parameter names

    Raises:
        AppError: If validation fails
    """
    # Check for unknown parameters
    for key in request.args.keys():
        if key not in allowed:
            raise AppError(UNKNOWN_PARAMETER, f"Unknown query parameter: '{key}'")

    # Check for duplicate parameters
    # request.args is a MultiDict, getlist returns all values for a key
    for key in request.args.keys():
        if len(request.args.getlist(key)) > 1:
            raise AppError(DUPLICATE_PARAMETER, f"Duplicate query parameter: '{key}'")


def validate_content_type() -> None:
    """
    Validate Content-Type header for POST requests.

    Raises:
        AppError: If Content-Type is not application/json
    """
    content_type = request.content_type or ''
    # Accept both "application/json" and "application/json; charset=utf-8"
    if not content_type.startswith('application/json'):
        raise AppError(
            UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported media type: '{content_type}'. Expected 'application/json; charset=utf-8'"
        )


def get_json_body() -> Dict[str, Any]:
    """
    Get and validate JSON body from request.

    Raises:
        AppError: If JSON is invalid

    Returns:
        Parsed JSON body as dictionary
    """
    try:
        data = request.get_json(force=True)
        if data is None:
            raise AppError(INVALID_JSON, "Request body must be valid JSON")
        if not isinstance(data, dict):
            raise AppError(INVALID_JSON, "Request body must be a JSON object")
        return data
    except Exception as e:
        if isinstance(e, AppError):
            raise
        raise AppError(INVALID_JSON, "Request body must be valid JSON")


def validate_viewer_param() -> str:
    """
    Validate and return the viewer query parameter.

    Raises:
        AppError: If viewer is missing or invalid

    Returns:
        Normalized viewer name
    """
    viewer = request.args.get('viewer')
    if viewer is None:
        raise AppError(MISSING_VIEWER, "Missing required 'viewer' query parameter")
    if not viewer.strip():
        raise AppError(INVALID_VIEWER, f"Invalid viewer: '{viewer}'")
    return normalize_name(viewer)


def validate_page_param(param_name: str = 'page', default: int = 1) -> int:
    """
    Validate and return a page query parameter.

    Args:
        param_name: Name of the page parameter
        default: Default value if not provided

    Raises:
        AppError: If page is invalid

    Returns:
        Validated page number
    """
    page_str = request.args.get(param_name)
    if page_str is None:
        return default

    try:
        page = validate_page_number(page_str)
        return page
    except PaginationError as e:
        raise AppError(INVALID_PAGE, f"Invalid page number: '{page_str}'. Must be a positive integer.")


def validate_uuid_param(value: str, param_name: str = 'id') -> str:
    """
    Validate a UUID parameter.

    Args:
        value: UUID string to validate
        param_name: Name of parameter for error message

    Raises:
        AppError: If UUID is invalid

    Returns:
        The validated UUID string
    """
    if not validate_uuid(value):
        raise AppError(INVALID_UUID, f"Invalid UUID format: '{value}'")
    return value


def validate_name_param(value: str) -> str:
    """
    Validate a name path parameter.

    Args:
        value: Name string to validate

    Raises:
        AppError: If name is invalid

    Returns:
        Normalized name
    """
    if not value or not value.strip():
        raise AppError(INVALID_NAME, f"Invalid name: '{value}'")
    return normalize_name(value)


# =============================================================================
# POST Body Validation Helpers
# =============================================================================

def validate_email_body(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Validate email creation request body.

    Checks in order:
    1. Unknown fields
    2. Missing required fields
    3. Field type/format validation

    Args:
        data: Request body dictionary

    Raises:
        AppError: If validation fails

    Returns:
        Validated and normalized email data
    """
    # Check for unknown fields
    unknown = check_unknown_fields(data)
    if unknown:
        raise AppError(UNKNOWN_FIELD, f"Unknown field in request: '{unknown[0]}'")

    # Check required fields
    required_fields = ['to', 'from', 'subject', 'content']
    for field in required_fields:
        if field not in data:
            raise AppError(MISSING_FIELD, f"Missing required field: '{field}'")

    # Validate 'to' field
    to_value = data.get('to')
    if not isinstance(to_value, list):
        raise AppError(INVALID_FIELD, "Invalid value for field: 'to' - to must be an array")
    if len(to_value) == 0:
        raise AppError(INVALID_FIELD, "Invalid value for field: 'to' - to must contain at least one recipient")
    for item in to_value:
        if not isinstance(item, str):
            raise AppError(INVALID_FIELD, "Invalid value for field: 'to' - to must contain only strings")
        if not item.strip():
            raise AppError(INVALID_FIELD, "Invalid value for field: 'to' - to contains empty or whitespace-only names")

    # Validate 'from' field
    from_value = data.get('from')
    if not isinstance(from_value, str):
        raise AppError(INVALID_FIELD, "Invalid value for field: 'from' - from must be a string")
    if not from_value.strip():
        raise AppError(INVALID_FIELD, "Invalid value for field: 'from' - from cannot be empty or whitespace")

    # Validate 'subject' field
    subject_value = data.get('subject')
    if not isinstance(subject_value, str):
        raise AppError(INVALID_FIELD, "Invalid value for field: 'subject' - subject must be a string")

    # Validate 'content' field
    content_value = data.get('content')
    if not isinstance(content_value, str):
        raise AppError(INVALID_FIELD, "Invalid value for field: 'content' - content must be a string")

    # Validate 'isResponseTo' if present
    is_response_to = data.get('isResponseTo')
    if is_response_to is not None:
        if not isinstance(is_response_to, str):
            raise AppError(INVALID_FIELD, "Invalid value for field: 'isResponseTo' - isResponseTo must be a string or null")
        if not validate_uuid(is_response_to):
            raise AppError(INVALID_UUID, f"Invalid UUID format: '{is_response_to}'")

    return data


# =============================================================================
# API Endpoints
# =============================================================================

@app.route('/health', methods=['GET'])
def health():
    """
    Health check endpoint.

    Returns 200 OK with status "ok".
    Rejects any query parameters.
    """
    validate_query_params([])
    return jsonify({"status": "ok"}), 200


@app.route('/mail', methods=['GET'])
def get_inbox():
    """
    Get inbox for a viewer.

    Query Parameters:
        viewer (required): Name of user viewing inbox
        page (optional): Page number (default: 1)

    Returns:
        Paginated list of emails for viewer
    """
    validate_query_params(['viewer', 'page'])

    viewer = validate_viewer_param()
    page = validate_page_param('page', 1)

    # Get storage and initialize if needed
    storage = get_storage()

    # Get inbox emails for viewer
    emails = get_inbox_for_viewer(viewer, storage)

    # Paginate results
    try:
        result = paginate_inbox(emails, page)
    except PaginationError as e:
        raise AppError(INVALID_PAGE, e.message)

    # Add 'read' field to each email in the response
    for email_dict in result['data']:
        # Find the original email to check read status
        email_id = email_dict['id']
        email = storage.get_by_id(email_id)
        if email:
            email_dict['read'] = get_read_status(email, viewer)
        else:
            email_dict['read'] = False

        # Remove content from inbox view (only summaries)
        if 'content' in email_dict:
            del email_dict['content']
        # Remove readBy and deletedBy from inbox view
        if 'readBy' in email_dict:
            del email_dict['readBy']
        if 'deletedBy' in email_dict:
            del email_dict['deletedBy']

    return jsonify(result), 200


@app.route('/mail/<mail_id>', methods=['GET'])
def get_email_detail(mail_id: str):
    """
    Get email detail with thread.

    Path Parameters:
        mail_id: UUID of the email

    Query Parameters:
        viewer (required): Name of user viewing email
        thread_page (optional): Page number for thread (default: 1)

    Returns:
        Full email with thread summaries
    """
    validate_query_params(['viewer', 'thread_page'])

    viewer = validate_viewer_param()
    mail_id = validate_uuid_param(mail_id, 'mail_id')
    thread_page = validate_page_param('thread_page', 1)

    storage = get_storage()

    # Get the email
    email = storage.get_by_id(mail_id)
    if email is None:
        raise AppError(EMAIL_NOT_FOUND, f"Email with id '{mail_id}' not found")

    # Check if deleted for this viewer
    if email.is_deleted_for(viewer):
        raise AppError(EMAIL_DELETED, f"Email with id '{mail_id}' has been deleted")

    # Mark as read (side effect)
    mark_as_read(mail_id, viewer, storage)

    # Build thread
    _, thread_emails = build_thread(mail_id, storage)

    # Paginate thread
    try:
        thread_result = paginate_thread(thread_emails, thread_page)
    except PaginationError as e:
        raise AppError(INVALID_PAGE, e.message)

    # Build email response with full content
    email_dict = email.to_dict()
    email_dict['read'] = get_read_status(email, viewer)
    # Remove readBy and deletedBy from email detail
    if 'readBy' in email_dict:
        del email_dict['readBy']
    if 'deletedBy' in email_dict:
        del email_dict['deletedBy']

    # Build thread summaries (no content)
    thread_summaries = []
    for thread_email_dict in thread_result['data']:
        summary = {
            'id': thread_email_dict['id'],
            'from': thread_email_dict['from'],
            'to': thread_email_dict['to'],
            'subject': thread_email_dict['subject'],
            'timestamp': thread_email_dict['timestamp'],
            'isResponseTo': thread_email_dict['isResponseTo']
        }
        thread_summaries.append(summary)

    # Build response
    response = {
        'email': email_dict,
        'thread': thread_summaries,
        'thread_pagination': {
            'page': thread_result['pagination']['page'],
            'per_page': thread_result['pagination']['per_page'],
            'total_in_thread': thread_result['pagination']['total_items'],
            'total_pages': thread_result['pagination']['total_pages'],
            'has_next': thread_result['pagination']['has_next'],
            'has_prev': thread_result['pagination']['has_prev']
        }
    }

    return jsonify(response), 200


@app.route('/mail', methods=['POST'])
def send_email():
    """
    Send a new email.

    Headers Required:
        Content-Type: application/json; charset=utf-8

    Request Body:
        to: List of recipient names
        from: Sender name
        subject: Subject line
        content: Email body
        isResponseTo (optional): UUID of parent email

    Returns:
        201 Created with new email ID
    """
    validate_query_params([])
    validate_content_type()

    data = get_json_body()
    validated_data = validate_email_body(data)

    storage = get_storage()

    # Expand "everyone" to all known agents (excluding sender)
    if 'everyone' in [name.lower() for name in validated_data['to']]:
        all_agents = get_all_known_agents(storage)
        sender = validated_data['from'].lower()

        # Remove "everyone" and add all known agents (excluding sender)
        expanded = [name for name in validated_data['to'] if name.lower() != 'everyone']
        expanded.extend([agent for agent in all_agents if agent != sender])

        # Deduplicate while preserving order
        seen = set()
        validated_data['to'] = [x for x in expanded if not (x in seen or seen.add(x))]

        # Handle empty expansion (no known agents to broadcast to)
        if not validated_data['to']:
            raise AppError(INVALID_FIELD, "No known agents to broadcast to")

    # Check parent exists if this is a reply
    is_response_to = validated_data.get('isResponseTo')
    if is_response_to:
        parent = storage.get_by_id(is_response_to)
        if parent is None:
            raise AppError(PARENT_NOT_FOUND, f"Parent email with id '{is_response_to}' not found")

    # Handle "Re: " prefix for replies
    subject = validated_data['subject']
    if is_response_to and not subject.lower().startswith('re:'):
        subject = f"Re: {subject}"

    # Create email
    email = Email(
        to=validated_data['to'],
        from_=validated_data['from'],
        subject=subject,
        content=validated_data['content'],
        is_response_to=is_response_to
    )

    # Auto-mark as read for sender (they wrote it, so they've "read" it)
    email.mark_read_by(validated_data['from'])

    # Store email
    storage.create(email)

    return jsonify({
        'id': email.id,
        'message': 'Email sent successfully'
    }), 201


@app.route('/mail/<mail_id>', methods=['DELETE'])
def delete_email(mail_id: str):
    """
    Soft-delete an email for a viewer.

    Path Parameters:
        mail_id: UUID of the email

    Query Parameters:
        viewer (required): Name of user deleting the email

    Returns:
        200 OK on success
    """
    validate_query_params(['viewer'])

    viewer = validate_viewer_param()
    mail_id = validate_uuid_param(mail_id, 'mail_id')

    storage = get_storage()

    # Get the email
    email = storage.get_by_id(mail_id)
    if email is None:
        raise AppError(EMAIL_NOT_FOUND, f"Email with id '{mail_id}' not found")

    # Check if viewer is a participant
    if not email.is_participant(viewer):
        raise AppError(NOT_PARTICIPANT, f"User '{viewer}' is not a participant in email '{mail_id}'")

    # Mark as deleted (idempotent)
    mark_as_deleted(mail_id, viewer, storage)

    return jsonify({'message': 'Email deleted'}), 200


@app.route('/investigation/<name>', methods=['GET'])
def get_investigation(name: str):
    """
    Get all emails for a person (investigation mode).

    Path Parameters:
        name: Name of person to investigate

    Query Parameters:
        page (optional): Page number (default: 1)

    Returns:
        Paginated list of ALL emails for person (including deleted)
    """
    validate_query_params(['page'])

    name = validate_name_param(name)
    page = validate_page_param('page', 1)

    storage = get_storage()

    # Get ALL emails where name is participant (including deleted)
    all_emails = storage.get_all()

    # Filter for emails where name is in 'to' or matches 'from'
    matching_emails = []
    for email in all_emails:
        is_recipient = name in email.to
        is_sender = name == email.from_
        if is_recipient or is_sender:
            matching_emails.append(email)

    # Sort by timestamp descending
    matching_emails.sort(key=lambda e: e.timestamp, reverse=True)

    # Paginate
    try:
        result = paginate_investigation([e.to_dict() for e in matching_emails], page)
    except PaginationError as e:
        raise AppError(INVALID_PAGE, e.message)

    return jsonify(result), 200


# =============================================================================
# Agent Directory Endpoints
# =============================================================================

@app.route('/directory/agents', methods=['GET'])
def get_agents():
    """
    Get all registered agents with their PIDs.

    Returns:
        200 OK with list of agents
    """
    validate_query_params([])

    storage = get_storage()
    agents_dict = storage.get_all_agents()

    agents_list = [
        {"name": name, "pid": pid}
        for name, pid in sorted(agents_dict.items())
    ]

    return jsonify({"agents": agents_list}), 200


@app.route('/directory/agents', methods=['POST'])
def register_agent():
    """
    Register a new agent (reserves name permanently).

    Request Body:
        {"name": "agent-name"}

    Returns:
        201 Created with agent info
    """
    validate_query_params([])
    validate_content_type()

    data = get_json_body()

    # Validate request body
    allowed_fields = {'name'}
    unknown_fields = set(data.keys()) - allowed_fields
    if unknown_fields:
        raise AppError(UNKNOWN_FIELD, f"Unknown field in request: '{list(unknown_fields)[0]}'")

    if 'name' not in data:
        raise AppError(MISSING_FIELD, "Missing required field: 'name'")

    name = data['name']
    if not isinstance(name, str):
        raise AppError(INVALID_FIELD, "Field 'name' must be a string")

    name = name.strip().lower()
    if not name:
        raise AppError(INVALID_NAME, "Agent name cannot be empty or whitespace")

    storage = get_storage()

    # Check if name is available
    if not storage.is_agent_name_available(name):
        raise AppError(NAME_TAKEN, f"Agent name '{name}' is already taken")

    # Register agent (spawn logic will be added later)
    storage.register_agent(name, pid=None)

    return jsonify({
        "name": name,
        "pid": None,
        "message": "Agent registered successfully"
    }), 201


@app.route('/directory/agents/check', methods=['GET'])
def check_agent_name():
    """
    Check if an agent name is available.

    Query Parameters:
        name (required): Name to check

    Returns:
        200 OK with availability status
    """
    validate_query_params(['name'])

    # Get and validate name parameter
    name = request.args.get('name')
    if name is None:
        raise AppError(MISSING_FIELD, "Missing required 'name' query parameter")

    name = name.strip().lower()
    if not name:
        raise AppError(INVALID_NAME, "Name parameter cannot be empty or whitespace")

    storage = get_storage()
    available = storage.is_agent_name_available(name)

    result = {
        "name": name,
        "available": available
    }

    return jsonify(result), 200


# =============================================================================
# Main Entry Point
# =============================================================================

if __name__ == '__main__':
    # Initialize storage on startup
    storage = get_storage()
    storage.initialize()

    app.run(host='0.0.0.0', port=60061, debug=True)
