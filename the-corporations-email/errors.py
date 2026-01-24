"""
Error codes and helpers for the-corporations-email server.
"""

from flask import jsonify
from typing import Tuple, Any


# Error codes
EMAIL_NOT_FOUND = "EMAIL_NOT_FOUND"
EMAIL_DELETED = "EMAIL_DELETED"
NOT_PARTICIPANT = "NOT_PARTICIPANT"
PARENT_NOT_FOUND = "PARENT_NOT_FOUND"
MISSING_FIELD = "MISSING_FIELD"
INVALID_FIELD = "INVALID_FIELD"
INVALID_JSON = "INVALID_JSON"
INVALID_UUID = "INVALID_UUID"
INVALID_PAGE = "INVALID_PAGE"
INVALID_NAME = "INVALID_NAME"
MISSING_VIEWER = "MISSING_VIEWER"
INVALID_VIEWER = "INVALID_VIEWER"
UNKNOWN_PARAMETER = "UNKNOWN_PARAMETER"
DUPLICATE_PARAMETER = "DUPLICATE_PARAMETER"
UNKNOWN_FIELD = "UNKNOWN_FIELD"
UNSUPPORTED_MEDIA_TYPE = "UNSUPPORTED_MEDIA_TYPE"

# Agent directory errors
NAME_TAKEN = "NAME_TAKEN"
AGENT_NOT_FOUND = "AGENT_NOT_FOUND"


# HTTP status code mapping for each error type
ERROR_STATUS_CODES = {
    EMAIL_NOT_FOUND: 404,
    EMAIL_DELETED: 410,
    NOT_PARTICIPANT: 403,
    PARENT_NOT_FOUND: 404,
    MISSING_FIELD: 400,
    INVALID_FIELD: 400,
    INVALID_JSON: 400,
    INVALID_UUID: 400,
    INVALID_PAGE: 400,
    INVALID_NAME: 400,
    MISSING_VIEWER: 400,
    INVALID_VIEWER: 400,
    UNKNOWN_PARAMETER: 400,
    DUPLICATE_PARAMETER: 400,
    UNKNOWN_FIELD: 400,
    UNSUPPORTED_MEDIA_TYPE: 415,
    NAME_TAKEN: 400,
    AGENT_NOT_FOUND: 404,
}


def create_error_response(message: str, code: str) -> Tuple[Any, int]:
    """
    Create a standardized error response.

    Args:
        message: Human-readable error message
        code: Error code constant (e.g., EMAIL_NOT_FOUND)

    Returns:
        Tuple of (JSON response, HTTP status code)
    """
    status_code = ERROR_STATUS_CODES.get(code, 400)
    response = {
        "error": message,
        "code": code
    }
    return jsonify(response), status_code


def error_email_not_found(email_id: str) -> Tuple[Any, int]:
    """Create error response for email not found."""
    return create_error_response(f"Email with id '{email_id}' not found", EMAIL_NOT_FOUND)


def error_email_deleted(email_id: str) -> Tuple[Any, int]:
    """Create error response for deleted email."""
    return create_error_response(f"Email with id '{email_id}' has been deleted", EMAIL_DELETED)


def error_not_participant(viewer: str, email_id: str) -> Tuple[Any, int]:
    """Create error response when viewer is not a participant."""
    return create_error_response(
        f"User '{viewer}' is not a participant in email '{email_id}'",
        NOT_PARTICIPANT
    )


def error_parent_not_found(parent_id: str) -> Tuple[Any, int]:
    """Create error response for parent email not found."""
    return create_error_response(
        f"Parent email with id '{parent_id}' not found",
        PARENT_NOT_FOUND
    )


def error_missing_field(field_name: str) -> Tuple[Any, int]:
    """Create error response for missing required field."""
    return create_error_response(f"Missing required field: '{field_name}'", MISSING_FIELD)


def error_invalid_field(field_name: str, reason: str = None) -> Tuple[Any, int]:
    """Create error response for invalid field value."""
    message = f"Invalid value for field: '{field_name}'"
    if reason:
        message += f" - {reason}"
    return create_error_response(message, INVALID_FIELD)


def error_invalid_json() -> Tuple[Any, int]:
    """Create error response for invalid JSON."""
    return create_error_response("Request body must be valid JSON", INVALID_JSON)


def error_invalid_uuid(value: str) -> Tuple[Any, int]:
    """Create error response for invalid UUID."""
    return create_error_response(f"Invalid UUID format: '{value}'", INVALID_UUID)


def error_invalid_page(page: Any) -> Tuple[Any, int]:
    """Create error response for invalid page number."""
    return create_error_response(
        f"Invalid page number: '{page}'. Must be a positive integer.",
        INVALID_PAGE
    )


def error_invalid_name(name: str) -> Tuple[Any, int]:
    """Create error response for invalid name."""
    return create_error_response(f"Invalid name: '{name}'", INVALID_NAME)


def error_missing_viewer() -> Tuple[Any, int]:
    """Create error response for missing viewer parameter."""
    return create_error_response("Missing required 'viewer' query parameter", MISSING_VIEWER)


def error_invalid_viewer(viewer: str) -> Tuple[Any, int]:
    """Create error response for invalid viewer."""
    return create_error_response(f"Invalid viewer: '{viewer}'", INVALID_VIEWER)


def error_unknown_parameter(param_name: str) -> Tuple[Any, int]:
    """Create error response for unknown query parameter."""
    return create_error_response(f"Unknown query parameter: '{param_name}'", UNKNOWN_PARAMETER)


def error_duplicate_parameter(param_name: str) -> Tuple[Any, int]:
    """Create error response for duplicate query parameter."""
    return create_error_response(
        f"Duplicate query parameter: '{param_name}'",
        DUPLICATE_PARAMETER
    )


def error_unknown_field(field_name: str) -> Tuple[Any, int]:
    """Create error response for unknown field in request body."""
    return create_error_response(f"Unknown field in request: '{field_name}'", UNKNOWN_FIELD)


def error_unsupported_media_type(content_type: str = None) -> Tuple[Any, int]:
    """Create error response for unsupported media type."""
    if content_type:
        message = f"Unsupported media type: '{content_type}'. Expected 'application/json'"
    else:
        message = "Content-Type must be 'application/json'"
    return create_error_response(message, UNSUPPORTED_MEDIA_TYPE)


def error_name_taken(name: str) -> Tuple[Any, int]:
    """Create error response for agent name already taken."""
    return create_error_response(f"Agent name '{name}' is already taken", NAME_TAKEN)


def error_agent_not_found(name: str) -> Tuple[Any, int]:
    """Create error response for agent not found."""
    return create_error_response(f"Agent '{name}' not found", AGENT_NOT_FOUND)
