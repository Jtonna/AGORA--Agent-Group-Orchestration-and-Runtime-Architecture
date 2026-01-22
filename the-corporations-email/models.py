"""
Email model and validation functions for the-corporations-email server.
"""

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import List, Optional, Dict, Any
import uuid
import re


def normalize_name(name: str) -> str:
    """
    Normalize a name by converting to lowercase and trimming whitespace.

    Args:
        name: The name to normalize

    Returns:
        Normalized name (lowercase, trimmed)
    """
    if not isinstance(name, str):
        raise ValueError(f"Name must be a string, got {type(name).__name__}")
    return name.strip().lower()


def normalize_name_list(names: List[str]) -> List[str]:
    """
    Normalize a list of names and remove duplicates while preserving order.

    Args:
        names: List of names to normalize

    Returns:
        List of normalized, deduplicated names
    """
    if not isinstance(names, list):
        raise ValueError(f"Names must be a list, got {type(names).__name__}")

    seen = set()
    result = []
    for name in names:
        normalized = normalize_name(name)
        if normalized and normalized not in seen:
            seen.add(normalized)
            result.append(normalized)
    return result


def validate_uuid(value: str) -> bool:
    """
    Validate that a string is a valid UUID.

    Args:
        value: String to validate

    Returns:
        True if valid UUID, False otherwise
    """
    if not isinstance(value, str):
        return False
    try:
        uuid.UUID(value)
        return True
    except ValueError:
        return False


def generate_uuid() -> str:
    """
    Generate a new UUID string.

    Returns:
        A new UUID as a string
    """
    return str(uuid.uuid4())


def generate_timestamp() -> str:
    """
    Generate an ISO 8601 UTC timestamp with Z suffix.

    Returns:
        Current UTC timestamp in ISO 8601 format with Z suffix
    """
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def validate_name(name: str) -> bool:
    """
    Validate that a name is valid (non-empty string after normalization).

    Args:
        name: Name to validate

    Returns:
        True if valid, False otherwise
    """
    if not isinstance(name, str):
        return False
    normalized = name.strip().lower()
    return len(normalized) > 0


def validate_name_list(names: List[str]) -> bool:
    """
    Validate that all names in a list are valid.

    Args:
        names: List of names to validate

    Returns:
        True if all valid, False otherwise
    """
    if not isinstance(names, list):
        return False
    if len(names) == 0:
        return False
    return all(validate_name(name) for name in names)


@dataclass
class Email:
    """
    Email model representing an email message.

    Attributes:
        id: Unique UUID identifier
        to: List of recipient names (normalized, deduplicated)
        from_: Sender name (normalized) - using from_ because 'from' is reserved
        subject: Email subject line
        content: Email body content
        timestamp: ISO 8601 UTC timestamp with Z suffix
        is_response_to: UUID of parent email or None
        read_by: List of names who have read the email
        deleted_by: List of names who have deleted the email
    """
    to: List[str]
    from_: str
    subject: str
    content: str
    id: str = field(default_factory=generate_uuid)
    timestamp: str = field(default_factory=generate_timestamp)
    is_response_to: Optional[str] = None
    read_by: List[str] = field(default_factory=list)
    deleted_by: List[str] = field(default_factory=list)

    def __post_init__(self):
        """Normalize and validate fields after initialization."""
        # Normalize the sender
        self.from_ = normalize_name(self.from_)

        # Normalize and deduplicate recipient list
        self.to = normalize_name_list(self.to)

        # Normalize and deduplicate read_by list
        self.read_by = normalize_name_list(self.read_by) if self.read_by else []

        # Normalize and deduplicate deleted_by list
        self.deleted_by = normalize_name_list(self.deleted_by) if self.deleted_by else []

        # Validate required fields
        if not self.to:
            raise ValueError("Email must have at least one recipient")
        if not self.from_:
            raise ValueError("Email must have a sender")
        if not isinstance(self.subject, str):
            raise ValueError("Subject must be a string")
        if not isinstance(self.content, str):
            raise ValueError("Content must be a string")

        # Validate is_response_to if provided
        if self.is_response_to is not None:
            if not validate_uuid(self.is_response_to):
                raise ValueError(f"Invalid UUID for is_response_to: {self.is_response_to}")

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert Email to dictionary format for JSON serialization.

        Returns:
            Dictionary representation of the email
        """
        return {
            "id": self.id,
            "to": self.to,
            "from": self.from_,
            "subject": self.subject,
            "content": self.content,
            "timestamp": self.timestamp,
            "isResponseTo": self.is_response_to,
            "readBy": self.read_by,
            "deletedBy": self.deleted_by
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Email':
        """
        Create an Email instance from a dictionary.

        Args:
            data: Dictionary containing email data

        Returns:
            Email instance
        """
        return cls(
            id=data.get("id", generate_uuid()),
            to=data.get("to", []),
            from_=data.get("from", ""),
            subject=data.get("subject", ""),
            content=data.get("content", ""),
            timestamp=data.get("timestamp", generate_timestamp()),
            is_response_to=data.get("isResponseTo"),
            read_by=data.get("readBy", []),
            deleted_by=data.get("deletedBy", [])
        )

    def get_participants(self) -> List[str]:
        """
        Get all participants in this email (sender + recipients).

        Returns:
            List of all participant names (normalized, deduplicated)
        """
        participants = set(self.to)
        participants.add(self.from_)
        return list(participants)

    def is_participant(self, name: str) -> bool:
        """
        Check if a name is a participant in this email.

        Args:
            name: Name to check

        Returns:
            True if participant, False otherwise
        """
        normalized = normalize_name(name)
        return normalized in self.get_participants()

    def is_deleted_for(self, name: str) -> bool:
        """
        Check if email is deleted for a specific user.

        Args:
            name: Name to check

        Returns:
            True if deleted for user, False otherwise
        """
        normalized = normalize_name(name)
        return normalized in self.deleted_by

    def mark_read_by(self, name: str) -> None:
        """
        Mark email as read by a user.

        Args:
            name: Name of user who read the email
        """
        normalized = normalize_name(name)
        if normalized not in self.read_by:
            self.read_by.append(normalized)

    def mark_deleted_by(self, name: str) -> None:
        """
        Mark email as deleted by a user.

        Args:
            name: Name of user who deleted the email
        """
        normalized = normalize_name(name)
        if normalized not in self.deleted_by:
            self.deleted_by.append(normalized)


def validate_email_data(data: Dict[str, Any]) -> List[str]:
    """
    Validate email data from a request body.

    Args:
        data: Dictionary containing email data

    Returns:
        List of validation error messages (empty if valid)
    """
    errors = []

    # Check required fields
    required_fields = ["to", "from", "subject", "content"]
    for field_name in required_fields:
        if field_name not in data:
            errors.append(f"Missing required field: '{field_name}'")

    # Validate 'to' field
    if "to" in data:
        if not isinstance(data["to"], list):
            errors.append("Field 'to' must be a list")
        elif len(data["to"]) == 0:
            errors.append("Field 'to' must contain at least one recipient")
        else:
            for i, recipient in enumerate(data["to"]):
                if not isinstance(recipient, str):
                    errors.append(f"Recipient at index {i} must be a string")
                elif not recipient.strip():
                    errors.append(f"Recipient at index {i} cannot be empty")

    # Validate 'from' field
    if "from" in data:
        if not isinstance(data["from"], str):
            errors.append("Field 'from' must be a string")
        elif not data["from"].strip():
            errors.append("Field 'from' cannot be empty")

    # Validate 'subject' field
    if "subject" in data:
        if not isinstance(data["subject"], str):
            errors.append("Field 'subject' must be a string")

    # Validate 'content' field
    if "content" in data:
        if not isinstance(data["content"], str):
            errors.append("Field 'content' must be a string")

    # Validate optional 'isResponseTo' field
    if "isResponseTo" in data and data["isResponseTo"] is not None:
        if not isinstance(data["isResponseTo"], str):
            errors.append("Field 'isResponseTo' must be a string or null")
        elif not validate_uuid(data["isResponseTo"]):
            errors.append(f"Field 'isResponseTo' must be a valid UUID")

    return errors


# List of allowed fields in email creation request
ALLOWED_EMAIL_FIELDS = {"to", "from", "subject", "content", "isResponseTo"}


def check_unknown_fields(data: Dict[str, Any]) -> List[str]:
    """
    Check for unknown fields in request data.

    Args:
        data: Dictionary containing request data

    Returns:
        List of unknown field names
    """
    return [key for key in data.keys() if key not in ALLOWED_EMAIL_FIELDS]
