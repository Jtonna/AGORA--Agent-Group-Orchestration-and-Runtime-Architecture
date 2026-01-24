"""
Storage singleton for the-corporations-email server.

Provides a thread-safe, queue-based JSON file storage layer with database-like
methods for email management. Implements startup validation and quarantine logic.
"""

import json
import logging
import os
import threading
from datetime import datetime, timezone
from pathlib import Path
from queue import Queue
from typing import Any, Callable, Dict, List, Optional, Tuple, TypeVar

from models import Email, validate_uuid, normalize_name

# Configure logging
logger = logging.getLogger(__name__)

# Type variable for generic return type
T = TypeVar('T')

# Default data directory and file paths
DEFAULT_DATA_DIR = "data"
DEFAULT_EMAILS_FILE = "emails.json"
DEFAULT_QUARANTINE_FILE = "quarantine.json"


class StorageError(Exception):
    """Base exception for storage errors."""
    pass


class StorageInitError(StorageError):
    """Exception raised when storage cannot be initialized."""
    pass


class EmailStorage:
    """
    Singleton storage class for email data management.

    Acts as the database layer for JSON file storage with:
    - Thread-safe operations via queue-based access
    - In-memory caching with file persistence
    - Startup validation and data recovery
    - Quarantine logic for invalid emails
    """

    _instance: Optional['EmailStorage'] = None
    _lock: threading.Lock = threading.Lock()
    _initialized: bool = False

    def __new__(cls, data_dir: Optional[str] = None) -> 'EmailStorage':
        """
        Create or return the singleton instance.

        Args:
            data_dir: Optional data directory path (only used on first creation)

        Returns:
            The singleton EmailStorage instance
        """
        if cls._instance is None:
            with cls._lock:
                # Double-check locking pattern
                if cls._instance is None:
                    cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self, data_dir: Optional[str] = None):
        """
        Initialize the storage instance.

        Args:
            data_dir: Optional data directory path
        """
        # Only initialize once
        if EmailStorage._initialized:
            return

        with EmailStorage._lock:
            if EmailStorage._initialized:
                return

            self._data_dir = Path(data_dir) if data_dir else Path(DEFAULT_DATA_DIR)
            self._emails_path = self._data_dir / DEFAULT_EMAILS_FILE
            self._quarantine_path = self._data_dir / DEFAULT_QUARANTINE_FILE

            # In-memory storage
            self._emails: Dict[str, Email] = {}
            self._quarantined: List[Dict[str, Any]] = []

            # Agent directory (in-memory only, no persistence)
            self._agent_registry: Dict[str, Optional[int]] = {}  # name -> pid
            self._registered_names: set = set()  # all names ever used (prevents reuse)

            # Operation queue for thread safety (RLock allows reentrant locking)
            self._operation_queue: Queue = Queue()
            self._queue_lock = threading.RLock()

            EmailStorage._initialized = True

    @classmethod
    def reset_instance(cls) -> None:
        """
        Reset the singleton instance. Used primarily for testing.
        """
        with cls._lock:
            # Reset agent registry if instance exists
            if cls._instance is not None:
                cls._instance._agent_registry = {}
                cls._instance._registered_names = set()
            cls._instance = None
            cls._initialized = False

    def _execute_with_lock(self, operation: Callable[[], T]) -> T:
        """
        Execute an operation with thread safety.

        Args:
            operation: Callable to execute

        Returns:
            Result of the operation
        """
        with self._queue_lock:
            return operation()

    def _generate_timestamp(self) -> str:
        """Generate ISO 8601 UTC timestamp with Z suffix."""
        return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    def _ensure_data_dir(self) -> None:
        """Create data directory if it doesn't exist."""
        self._data_dir.mkdir(parents=True, exist_ok=True)

    def _read_json_file(self, path: Path) -> Optional[Dict[str, Any]]:
        """
        Read and parse a JSON file.

        Args:
            path: Path to the JSON file

        Returns:
            Parsed JSON data or None if file doesn't exist

        Raises:
            StorageError: If file exists but cannot be parsed
        """
        if not path.exists():
            return None

        try:
            with open(path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except json.JSONDecodeError as e:
            raise StorageError(f"Invalid JSON in {path}: {e}")
        except IOError as e:
            raise StorageError(f"Cannot read {path}: {e}")

    def _write_json_file(self, path: Path, data: Dict[str, Any]) -> None:
        """
        Write data to a JSON file.

        Args:
            path: Path to the JSON file
            data: Data to write
        """
        self._ensure_data_dir()
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def _create_empty_emails_file(self) -> Dict[str, Any]:
        """Create an empty emails file and return its content."""
        data = {"version": 1, "emails": []}
        self._write_json_file(self._emails_path, data)
        logger.info(f"Created new emails file: {self._emails_path}")
        return data

    def _create_empty_quarantine_file(self) -> Dict[str, Any]:
        """Create an empty quarantine file and return its content."""
        data = {"version": 1, "quarantined": []}
        self._write_json_file(self._quarantine_path, data)
        logger.info(f"Created new quarantine file: {self._quarantine_path}")
        return data

    def _backup_file(self, path: Path, suffix: str) -> Path:
        """
        Create a backup of a file with timestamp.

        Args:
            path: Path to the file to backup
            suffix: Suffix for the backup file (e.g., 'old', 'bak')

        Returns:
            Path to the backup file
        """
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H-%M-%SZ")
        backup_path = path.parent / f"{path.name}.{suffix}.{timestamp}"
        path.rename(backup_path)
        logger.warning(f"Renamed {path} to {backup_path}")
        return backup_path

    def _validate_file_structure(self, data: Dict[str, Any], file_type: str) -> Tuple[bool, str]:
        """
        Validate the basic structure of a data file.

        Args:
            data: Parsed JSON data
            file_type: 'emails' or 'quarantine'

        Returns:
            Tuple of (is_valid, error_message)
        """
        if not isinstance(data, dict):
            return False, f"Expected object, got {type(data).__name__}"

        if "version" not in data:
            return False, "Missing 'version' field"

        expected_key = "emails" if file_type == "emails" else "quarantined"
        # Note: missing 'emails' key is recoverable, not a structure error
        if file_type == "quarantine" and expected_key not in data:
            return False, f"Missing '{expected_key}' field"

        return True, ""

    def _validate_version(self, version: Any) -> Tuple[bool, bool]:
        """
        Validate the version field.

        Args:
            version: Version value to validate

        Returns:
            Tuple of (is_valid, needs_conversion)
            - is_valid: True if version is 1 or "1"
            - needs_conversion: True if version is string "1" and needs conversion
        """
        if version == 1:
            return True, False
        if version == "1":
            return True, True
        return False, False

    def _validate_timestamp(self, timestamp: str) -> bool:
        """
        Validate an ISO 8601 timestamp with Z suffix.

        Args:
            timestamp: Timestamp string to validate

        Returns:
            True if valid, False otherwise
        """
        if not isinstance(timestamp, str):
            return False
        try:
            # Must end with Z
            if not timestamp.endswith('Z'):
                return False
            # Parse the timestamp
            datetime.strptime(timestamp, "%Y-%m-%dT%H:%M:%SZ")
            return True
        except ValueError:
            return False

    def _validate_email_data(self, data: Dict[str, Any]) -> Tuple[bool, List[str], Dict[str, Any]]:
        """
        Validate and potentially fix email data.

        Args:
            data: Raw email data

        Returns:
            Tuple of (is_valid, error_reasons, fixed_data)
            - is_valid: True if email is valid (possibly after fixes)
            - error_reasons: List of unrecoverable error reasons (empty if valid)
            - fixed_data: Email data with recoverable fixes applied
        """
        errors = []
        fixed = dict(data)

        # Required fields
        required_fields = ['id', 'to', 'from', 'subject', 'content', 'timestamp']
        for field in required_fields:
            if field not in data:
                errors.append(f"missing required field: {field}")

        # If missing required fields, return early
        if errors:
            return False, errors, fixed

        # Validate and fix field types

        # id - must be valid UUID
        if not isinstance(data.get('id'), str):
            errors.append(f"field 'id' must be a string")
        elif not validate_uuid(data['id']):
            errors.append(f"invalid UUID format for 'id': {data['id']}")

        # to - must be array of strings
        if not isinstance(data.get('to'), list):
            errors.append("field 'to' must be an array")
        else:
            # Filter non-strings and normalize
            valid_recipients = []
            for item in data['to']:
                if isinstance(item, str):
                    normalized = item.strip().lower()
                    if normalized:
                        valid_recipients.append(normalized)
            # Deduplicate while preserving order
            seen = set()
            deduped = []
            for name in valid_recipients:
                if name not in seen:
                    seen.add(name)
                    deduped.append(name)
            fixed['to'] = deduped

            if not fixed['to']:
                errors.append("field 'to' must have at least one valid recipient")

        # from - must be string
        if not isinstance(data.get('from'), str):
            errors.append("field 'from' must be a string")
        else:
            fixed['from'] = data['from'].strip().lower()
            if not fixed['from']:
                errors.append("field 'from' cannot be empty")

        # subject - must be string
        if not isinstance(data.get('subject'), str):
            errors.append("field 'subject' must be a string")
        else:
            fixed['subject'] = data['subject'].strip()

        # content - must be string
        if not isinstance(data.get('content'), str):
            errors.append("field 'content' must be a string")
        else:
            fixed['content'] = data['content'].strip()

        # timestamp - must be valid ISO 8601
        if not self._validate_timestamp(data.get('timestamp', '')):
            errors.append(f"invalid timestamp format: {data.get('timestamp')}")

        # isResponseTo - optional, but if present must be valid UUID or null
        if 'isResponseTo' in data:
            if data['isResponseTo'] is not None:
                if not isinstance(data['isResponseTo'], str):
                    errors.append("field 'isResponseTo' must be a string or null")
                elif not validate_uuid(data['isResponseTo']):
                    errors.append(f"invalid UUID format for 'isResponseTo': {data['isResponseTo']}")

        # readBy - default to [], filter non-strings, normalize, dedupe
        if 'readBy' not in data:
            fixed['readBy'] = []
            logger.debug(f"Email {data.get('id')}: added missing 'readBy' field")
        elif not isinstance(data['readBy'], list):
            errors.append("field 'readBy' must be an array")
        else:
            valid_readers = []
            for item in data['readBy']:
                if isinstance(item, str):
                    normalized = item.strip().lower()
                    if normalized:
                        valid_readers.append(normalized)
            # Deduplicate
            seen = set()
            deduped = []
            for name in valid_readers:
                if name not in seen:
                    seen.add(name)
                    deduped.append(name)
            if len(deduped) != len(data['readBy']):
                logger.debug(f"Email {data.get('id')}: normalized/deduped 'readBy'")
            fixed['readBy'] = deduped

        # deletedBy - default to [], filter non-strings, normalize, dedupe
        if 'deletedBy' not in data:
            fixed['deletedBy'] = []
            logger.debug(f"Email {data.get('id')}: added missing 'deletedBy' field")
        elif not isinstance(data['deletedBy'], list):
            errors.append("field 'deletedBy' must be an array")
        else:
            valid_deleters = []
            for item in data['deletedBy']:
                if isinstance(item, str):
                    normalized = item.strip().lower()
                    if normalized:
                        valid_deleters.append(normalized)
            # Deduplicate
            seen = set()
            deduped = []
            for name in valid_deleters:
                if name not in seen:
                    seen.add(name)
                    deduped.append(name)
            if len(deduped) != len(data['deletedBy']):
                logger.debug(f"Email {data.get('id')}: normalized/deduped 'deletedBy'")
            fixed['deletedBy'] = deduped

        # Strip extra fields not in schema
        allowed_fields = {'id', 'to', 'from', 'subject', 'content', 'timestamp',
                          'isResponseTo', 'readBy', 'deletedBy'}
        extra_fields = set(fixed.keys()) - allowed_fields
        for field in extra_fields:
            del fixed[field]
            logger.debug(f"Email {data.get('id')}: stripped extra field '{field}'")

        return len(errors) == 0, errors, fixed

    def _quarantine_email(self, email_data: Dict[str, Any], reason: str) -> None:
        """
        Add an email to quarantine.

        Args:
            email_data: Original email data
            reason: Reason for quarantine
        """
        quarantine_entry = {
            "original": email_data,
            "reason": reason,
            "quarantined_at": self._generate_timestamp()
        }
        self._quarantined.append(quarantine_entry)
        logger.warning(f"Quarantined email: {reason}")

    def _save_emails(self) -> None:
        """Save the current email data to file."""
        def _write():
            data = {
                "version": 1,
                "emails": [email.to_dict() for email in self._emails.values()]
            }
            self._write_json_file(self._emails_path, data)
            logger.debug(f"Saved {len(self._emails)} emails to {self._emails_path}")

        self._execute_with_lock(_write)

    def _save_quarantine(self) -> None:
        """Save the current quarantine data to file."""
        def _write():
            data = {
                "version": 1,
                "quarantined": self._quarantined
            }
            self._write_json_file(self._quarantine_path, data)
            logger.debug(f"Saved {len(self._quarantined)} quarantined entries to {self._quarantine_path}")

        self._execute_with_lock(_write)

    def initialize(self) -> None:
        """
        Initialize storage by loading and validating data files.

        This method should be called during application startup.

        Raises:
            StorageInitError: If emails.json is invalid and cannot be recovered
        """
        logger.info("Initializing email storage...")

        self._ensure_data_dir()

        # Handle emails.json
        try:
            emails_data = self._read_json_file(self._emails_path)
        except StorageError as e:
            logger.error(f"Cannot start: {e}")
            raise StorageInitError(f"emails.json is invalid: {e}")

        if emails_data is None:
            # File doesn't exist - create empty
            emails_data = self._create_empty_emails_file()
        else:
            # Validate structure
            is_valid, error = self._validate_file_structure(emails_data, "emails")
            if not is_valid:
                logger.error(f"Cannot start: emails.json has invalid structure: {error}")
                raise StorageInitError(f"emails.json has invalid structure: {error}")

            # Validate version
            version_valid, needs_conversion = self._validate_version(emails_data.get('version'))
            if not version_valid:
                # Unsupported version - backup and create fresh
                logger.warning(f"Unsupported version in emails.json: {emails_data.get('version')}")
                self._backup_file(self._emails_path, "old")
                emails_data = self._create_empty_emails_file()
            elif needs_conversion:
                # Convert string version to int
                emails_data['version'] = 1
                logger.debug("Converted version from string to integer")

        # Handle missing 'emails' key (recoverable)
        if 'emails' not in emails_data:
            emails_data['emails'] = []
            logger.debug("Added missing 'emails' key with default empty array")

        if not isinstance(emails_data['emails'], list):
            logger.error("Cannot start: 'emails' field is not an array")
            raise StorageInitError("emails.json 'emails' field is not an array")

        # Handle quarantine.json
        try:
            quarantine_data = self._read_json_file(self._quarantine_path)
        except StorageError as e:
            # Invalid quarantine file - backup and create fresh
            logger.warning(f"Invalid quarantine.json: {e}")
            self._backup_file(self._quarantine_path, "bak")
            quarantine_data = self._create_empty_quarantine_file()

        if quarantine_data is None:
            # File doesn't exist - create empty
            quarantine_data = self._create_empty_quarantine_file()
        else:
            # Validate structure and version
            is_valid, error = self._validate_file_structure(quarantine_data, "quarantine")
            if not is_valid:
                logger.warning(f"Invalid quarantine.json structure: {error}")
                self._backup_file(self._quarantine_path, "bak")
                quarantine_data = self._create_empty_quarantine_file()
            else:
                version_valid, needs_conversion = self._validate_version(quarantine_data.get('version'))
                if not version_valid:
                    logger.warning(f"Unsupported version in quarantine.json: {quarantine_data.get('version')}")
                    self._backup_file(self._quarantine_path, "bak")
                    quarantine_data = self._create_empty_quarantine_file()
                elif needs_conversion:
                    quarantine_data['version'] = 1
                    logger.debug("Converted quarantine version from string to integer")

        # Load existing quarantine entries
        self._quarantined = quarantine_data.get('quarantined', [])

        # Validate and load emails
        valid_emails: Dict[str, Email] = {}
        id_occurrences: Dict[str, List[Dict[str, Any]]] = {}

        # First pass: group emails by ID to detect duplicates
        for email_data in emails_data['emails']:
            email_id = email_data.get('id')
            if email_id:
                if email_id not in id_occurrences:
                    id_occurrences[email_id] = []
                id_occurrences[email_id].append(email_data)

        # Second pass: validate and process emails
        for email_data in emails_data['emails']:
            email_id = email_data.get('id')

            # Check for duplicate IDs
            if email_id and len(id_occurrences.get(email_id, [])) > 1:
                self._quarantine_email(email_data, f"duplicate id: {email_id}")
                continue

            # Validate and fix email data
            is_valid, errors, fixed_data = self._validate_email_data(email_data)

            if not is_valid:
                reason = "; ".join(errors)
                self._quarantine_email(email_data, reason)
                continue

            # Create Email object
            try:
                email = Email(
                    id=fixed_data['id'],
                    to=fixed_data['to'],
                    from_=fixed_data['from'],
                    subject=fixed_data['subject'],
                    content=fixed_data['content'],
                    timestamp=fixed_data['timestamp'],
                    is_response_to=fixed_data.get('isResponseTo'),
                    read_by=fixed_data.get('readBy', []),
                    deleted_by=fixed_data.get('deletedBy', [])
                )
                valid_emails[email.id] = email
            except Exception as e:
                self._quarantine_email(email_data, f"failed to create Email object: {e}")

        self._emails = valid_emails

        # Save files if any changes were made
        self._save_emails()
        self._save_quarantine()

        logger.info(f"Storage initialized: {len(self._emails)} emails loaded, {len(self._quarantined)} quarantined")

    # Database-like methods

    def get_all(self) -> List[Email]:
        """
        Get all emails.

        Returns:
            List of all Email objects
        """
        def _get():
            return list(self._emails.values())
        return self._execute_with_lock(_get)

    def get_by_id(self, email_id: str) -> Optional[Email]:
        """
        Get an email by ID.

        Args:
            email_id: Email UUID

        Returns:
            Email object or None if not found
        """
        def _get():
            return self._emails.get(email_id)
        return self._execute_with_lock(_get)

    def create(self, email: Email) -> Email:
        """
        Create a new email.

        Args:
            email: Email object to create

        Returns:
            Created Email object
        """
        def _create():
            self._emails[email.id] = email
            self._save_emails()
            logger.debug(f"Created email: {email.id}")
            return email
        return self._execute_with_lock(_create)

    def update(self, email: Email) -> Optional[Email]:
        """
        Update an existing email.

        Args:
            email: Email object with updated data

        Returns:
            Updated Email object or None if not found
        """
        def _update():
            if email.id not in self._emails:
                return None
            self._emails[email.id] = email
            self._save_emails()
            logger.debug(f"Updated email: {email.id}")
            return email
        return self._execute_with_lock(_update)

    def delete(self, email_id: str) -> bool:
        """
        Delete an email by ID.

        Args:
            email_id: Email UUID

        Returns:
            True if deleted, False if not found
        """
        def _delete():
            if email_id not in self._emails:
                return False
            del self._emails[email_id]
            self._save_emails()
            logger.debug(f"Deleted email: {email_id}")
            return True
        return self._execute_with_lock(_delete)

    def exists(self, email_id: str) -> bool:
        """
        Check if an email exists.

        Args:
            email_id: Email UUID

        Returns:
            True if exists, False otherwise
        """
        def _exists():
            return email_id in self._emails
        return self._execute_with_lock(_exists)

    def get_quarantined(self) -> List[Dict[str, Any]]:
        """
        Get all quarantined emails.

        Returns:
            List of quarantine entries
        """
        def _get():
            return list(self._quarantined)
        return self._execute_with_lock(_get)

    def add_to_quarantine(self, email_data: Dict[str, Any], reason: str) -> None:
        """
        Add an email to quarantine.

        Args:
            email_data: Original email data
            reason: Reason for quarantine
        """
        def _add():
            self._quarantine_email(email_data, reason)
            self._save_quarantine()
        self._execute_with_lock(_add)

    # =========================================================================
    # Agent Directory Methods (in-memory only)
    # =========================================================================

    def is_agent_name_available(self, name: str) -> bool:
        """
        Check if an agent name is available (never been used).

        Args:
            name: Agent name to check

        Returns:
            True if name is available, False if already used
        """
        def _check():
            return normalize_name(name) not in self._registered_names
        return self._execute_with_lock(_check)

    def register_agent(self, name: str, pid: Optional[int] = None) -> None:
        """
        Register a new agent (reserves name permanently).

        Args:
            name: Agent name (will be normalized to lowercase)
            pid: Process ID (optional, can be None)

        Raises:
            ValueError: If name is already taken
        """
        def _register():
            normalized = normalize_name(name)
            if normalized in self._registered_names:
                raise ValueError(f"Agent name '{normalized}' is already taken")
            self._registered_names.add(normalized)
            self._agent_registry[normalized] = pid
        self._execute_with_lock(_register)

    def update_agent_pid(self, name: str, pid: int) -> bool:
        """
        Update an agent's PID.

        Args:
            name: Agent name
            pid: New process ID

        Returns:
            True if agent exists and was updated, False if not found
        """
        def _update():
            normalized = normalize_name(name)
            if normalized not in self._registered_names:
                return False
            self._agent_registry[normalized] = pid
            return True
        return self._execute_with_lock(_update)

    def get_all_agents(self) -> Dict[str, Optional[int]]:
        """
        Get all registered agents with their PIDs.

        Returns:
            Dictionary of agent name -> PID (PID can be None)
        """
        def _get():
            return dict(self._agent_registry)
        return self._execute_with_lock(_get)

    def get_registered_agent_names(self) -> List[str]:
        """
        Get list of all registered agent names.

        Returns:
            List of agent names
        """
        def _get():
            return list(self._agent_registry.keys())
        return self._execute_with_lock(_get)


# Module-level convenience function
def get_storage(data_dir: Optional[str] = None) -> EmailStorage:
    """
    Get the EmailStorage singleton instance.

    Args:
        data_dir: Optional data directory path (only used on first creation)

    Returns:
        EmailStorage singleton instance
    """
    return EmailStorage(data_dir)
