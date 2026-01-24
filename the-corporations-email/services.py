"""
Business logic layer for the-corporations-email server.

This module provides services for:
- Inbox filtering (agora-12)
- Thread building (agora-13)
- Pagination helpers (agora-14)
- Read/delete status management (agora-15)
"""

from typing import List, Dict, Any, Optional, Tuple
from models import Email, normalize_name
from storage import get_storage, EmailStorage


# ============================================================================
# agora-12: Inbox Filtering Service
# ============================================================================

def get_inbox_for_viewer(viewer: str, storage: Optional[EmailStorage] = None) -> List[Email]:
    """
    Get all emails visible to a viewer (inbox).

    Filtering logic:
    - Include emails where viewer is in 'to' array OR viewer matches 'from' (case-insensitive)
    - Exclude emails where viewer is in 'deletedBy' array
    - Sort by timestamp descending (most recent first)

    Args:
        viewer: The viewer's name (will be normalized to lowercase)
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        List of Email objects visible to the viewer, sorted by timestamp descending
    """
    if storage is None:
        storage = get_storage()

    # Normalize viewer name for case-insensitive comparison
    normalized_viewer = normalize_name(viewer)

    # Get all emails
    all_emails = storage.get_all()

    # Filter emails for this viewer
    visible_emails = []
    for email in all_emails:
        # Check if viewer is a participant (in 'to' or is the sender)
        is_recipient = normalized_viewer in email.to
        is_sender = normalized_viewer == email.from_

        # Check if viewer has deleted this email
        is_deleted = normalized_viewer in email.deleted_by

        # Include if participant and not deleted
        if (is_recipient or is_sender) and not is_deleted:
            visible_emails.append(email)

    # Sort by timestamp descending (most recent first)
    visible_emails.sort(key=lambda e: e.timestamp, reverse=True)

    return visible_emails


def filter_emails_for_viewer(emails: List[Email], viewer: str) -> List[Email]:
    """
    Filter a list of emails for a specific viewer.

    This is a utility function that applies the same filtering logic
    as get_inbox_for_viewer but on a provided list of emails.

    Args:
        emails: List of Email objects to filter
        viewer: The viewer's name (will be normalized to lowercase)

    Returns:
        Filtered list of Email objects visible to the viewer
    """
    normalized_viewer = normalize_name(viewer)

    visible_emails = []
    for email in emails:
        is_recipient = normalized_viewer in email.to
        is_sender = normalized_viewer == email.from_
        is_deleted = normalized_viewer in email.deleted_by

        if (is_recipient or is_sender) and not is_deleted:
            visible_emails.append(email)

    return visible_emails


# ============================================================================
# agora-13: Thread Building Service
# ============================================================================

def find_thread_root(email_id: str, storage: Optional[EmailStorage] = None) -> Optional[Email]:
    """
    Find the root email of a thread by following isResponseTo chain upward.

    Uses iteration (not recursion) to avoid stack overflow.
    Uses a visited set to detect cycles (defensive - stops traversal if corruption).

    Args:
        email_id: Starting email UUID
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        Root Email object, or None if starting email not found
    """
    if storage is None:
        storage = get_storage()

    current_email = storage.get_by_id(email_id)
    if current_email is None:
        return None

    visited = set()
    visited.add(current_email.id)

    # Follow isResponseTo chain upward until we find root (no parent)
    while current_email.is_response_to is not None:
        parent_id = current_email.is_response_to

        # Cycle detection
        if parent_id in visited:
            # Corruption detected - stop traversal and return current as root
            break

        parent_email = storage.get_by_id(parent_id)
        if parent_email is None:
            # Parent not found - current email is effectively the root
            break

        visited.add(parent_id)
        current_email = parent_email

    return current_email


def find_thread_descendants(root_id: str, storage: Optional[EmailStorage] = None) -> List[Email]:
    """
    Find all descendants (replies) of a thread starting from root.

    Scans all emails for those with isResponseTo pointing to any email in thread.

    Args:
        root_id: Root email UUID
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        List of all emails in the thread (including root)
    """
    if storage is None:
        storage = get_storage()

    all_emails = storage.get_all()

    # Build set of email IDs in thread
    thread_ids = {root_id}
    thread_emails = []

    # Get root email
    root_email = storage.get_by_id(root_id)
    if root_email:
        thread_emails.append(root_email)

    # Keep scanning until no new emails are added
    changed = True
    while changed:
        changed = False
        for email in all_emails:
            if email.id not in thread_ids and email.is_response_to in thread_ids:
                thread_ids.add(email.id)
                thread_emails.append(email)
                changed = True

    return thread_emails


def build_thread(email_id: str, storage: Optional[EmailStorage] = None) -> Tuple[Optional[Email], List[Email]]:
    """
    Build complete thread for an email.

    1. Find root email by following isResponseTo chain upward
    2. Find all descendants by scanning for emails with isResponseTo pointing to any email in thread
    3. Exclude requested email from thread array (it's in 'email' field)
    4. Sort by timestamp descending (newest first)
    5. Thread includes ALL emails regardless of delete status

    Args:
        email_id: The email ID to build thread for
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        Tuple of (requested_email, thread_emails)
        - requested_email: The email that was requested (None if not found)
        - thread_emails: List of other emails in thread, sorted by timestamp descending
    """
    if storage is None:
        storage = get_storage()

    # Get the requested email
    requested_email = storage.get_by_id(email_id)
    if requested_email is None:
        return None, []

    # Find root of thread
    root = find_thread_root(email_id, storage)
    if root is None:
        return requested_email, []

    # Find all descendants
    all_thread_emails = find_thread_descendants(root.id, storage)

    # Exclude the requested email from thread array
    thread_emails = [e for e in all_thread_emails if e.id != email_id]

    # Sort by timestamp descending (newest first)
    thread_emails.sort(key=lambda e: e.timestamp, reverse=True)

    return requested_email, thread_emails


# ============================================================================
# agora-14: Pagination Helpers
# ============================================================================

# Page sizes for different endpoints
PAGE_SIZE_INBOX = 10
PAGE_SIZE_THREAD = 20
PAGE_SIZE_INVESTIGATION = 20


class PaginationError(Exception):
    """Exception raised for pagination validation errors."""
    def __init__(self, message: str, code: str = "INVALID_PAGE"):
        self.message = message
        self.code = code
        super().__init__(message)


def validate_page_number(page: Any) -> int:
    """
    Validate and convert page number.

    Args:
        page: Page number to validate (can be string or int)

    Returns:
        Validated page number as integer

    Raises:
        PaginationError: If page is not a positive integer
    """
    try:
        # Reject floats (even those like 1.0)
        if isinstance(page, float):
            raise PaginationError(f"Page must be a positive integer, got {page}")

        page_int = int(page)
        if page_int < 1:
            raise PaginationError(f"Page must be a positive integer, got {page}")

        # For strings, verify no decimal point
        if isinstance(page, str) and '.' in page:
            raise PaginationError(f"Page must be a positive integer, got {page}")

        return page_int
    except (ValueError, TypeError):
        raise PaginationError(f"Page must be a positive integer, got {page}")


def paginate(
    items: List[Any],
    page: int,
    per_page: int,
    allow_empty: bool = True
) -> Dict[str, Any]:
    """
    Paginate a list of items.

    Args:
        items: List of items to paginate
        page: Page number (1-indexed)
        per_page: Number of items per page
        allow_empty: If True, allows returning empty results for page 1

    Returns:
        Dictionary with 'data' and 'pagination' keys:
        {
            "data": [...],
            "pagination": {
                "page": 1,
                "per_page": 10,
                "total_items": 47,
                "total_pages": 5,
                "has_next": True,
                "has_prev": False
            }
        }

    Raises:
        PaginationError: If page number is invalid or exceeds total pages
    """
    total_items = len(items)

    # Handle empty results
    if total_items == 0:
        if not allow_empty and page != 1:
            raise PaginationError(f"Page {page} exceeds total pages (1)")
        return {
            "data": [],
            "pagination": {
                "page": 1,
                "per_page": per_page,
                "total_items": 0,
                "total_pages": 1,
                "has_next": False,
                "has_prev": False
            }
        }

    # Calculate total pages
    total_pages = (total_items + per_page - 1) // per_page  # Ceiling division

    # Validate page doesn't exceed total
    if page > total_pages:
        raise PaginationError(f"Page {page} exceeds total pages ({total_pages})")

    # Calculate slice indices
    start_idx = (page - 1) * per_page
    end_idx = start_idx + per_page

    # Get page data
    page_data = items[start_idx:end_idx]

    return {
        "data": page_data,
        "pagination": {
            "page": page,
            "per_page": per_page,
            "total_items": total_items,
            "total_pages": total_pages,
            "has_next": page < total_pages,
            "has_prev": page > 1
        }
    }


def paginate_inbox(emails: List[Email], page: int) -> Dict[str, Any]:
    """
    Paginate inbox emails (10 per page).

    Args:
        emails: List of Email objects
        page: Page number (1-indexed)

    Returns:
        Paginated result with Email objects converted to dicts
    """
    page = validate_page_number(page)
    result = paginate(emails, page, PAGE_SIZE_INBOX)
    result["data"] = [email.to_dict() for email in result["data"]]
    return result


def paginate_thread(emails: List[Email], page: int) -> Dict[str, Any]:
    """
    Paginate thread emails (20 per page).

    Args:
        emails: List of Email objects
        page: Page number (1-indexed)

    Returns:
        Paginated result with Email objects converted to dicts
    """
    page = validate_page_number(page)
    result = paginate(emails, page, PAGE_SIZE_THREAD)
    result["data"] = [email.to_dict() for email in result["data"]]
    return result


def paginate_investigation(items: List[Any], page: int) -> Dict[str, Any]:
    """
    Paginate investigation results (20 per page).

    Args:
        items: List of items to paginate
        page: Page number (1-indexed)

    Returns:
        Paginated result
    """
    page = validate_page_number(page)
    return paginate(items, page, PAGE_SIZE_INVESTIGATION)


# ============================================================================
# agora-15: Read/Delete Status Management
# ============================================================================

def mark_as_read(email_id: str, viewer: str, storage: Optional[EmailStorage] = None) -> bool:
    """
    Mark an email as read by a viewer.

    Adds viewer (lowercase) to readBy array (dedupe).
    Idempotent: marking already-read is a no-op (success).

    Args:
        email_id: Email UUID
        viewer: Viewer name (will be normalized to lowercase)
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        True if email exists and was marked, False if email not found
    """
    if storage is None:
        storage = get_storage()

    email = storage.get_by_id(email_id)
    if email is None:
        return False

    normalized_viewer = normalize_name(viewer)

    # Use Email model's method (handles deduplication)
    email.mark_read_by(normalized_viewer)

    # Persist changes
    storage.update(email)

    return True


def mark_as_deleted(email_id: str, viewer: str, storage: Optional[EmailStorage] = None) -> bool:
    """
    Mark an email as deleted by a viewer.

    Adds viewer (lowercase) to deletedBy array (dedupe).
    Idempotent: marking already-deleted is a no-op (success).

    Args:
        email_id: Email UUID
        viewer: Viewer name (will be normalized to lowercase)
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        True if email exists and was marked, False if email not found
    """
    if storage is None:
        storage = get_storage()

    email = storage.get_by_id(email_id)
    if email is None:
        return False

    normalized_viewer = normalize_name(viewer)

    # Use Email model's method (handles deduplication)
    email.mark_deleted_by(normalized_viewer)

    # Persist changes
    storage.update(email)

    return True


def is_read_by(email_id: str, viewer: str, storage: Optional[EmailStorage] = None) -> Optional[bool]:
    """
    Check if an email has been read by a viewer.

    Args:
        email_id: Email UUID
        viewer: Viewer name (will be normalized to lowercase)
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        True if viewer has read the email,
        False if viewer has not read the email,
        None if email not found
    """
    if storage is None:
        storage = get_storage()

    email = storage.get_by_id(email_id)
    if email is None:
        return None

    normalized_viewer = normalize_name(viewer)
    return normalized_viewer in email.read_by


def is_deleted_by(email_id: str, viewer: str, storage: Optional[EmailStorage] = None) -> Optional[bool]:
    """
    Check if an email has been deleted by a viewer.

    Args:
        email_id: Email UUID
        viewer: Viewer name (will be normalized to lowercase)
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        True if viewer has deleted the email,
        False if viewer has not deleted the email,
        None if email not found
    """
    if storage is None:
        storage = get_storage()

    email = storage.get_by_id(email_id)
    if email is None:
        return None

    normalized_viewer = normalize_name(viewer)
    return normalized_viewer in email.deleted_by


def get_read_status(email: Email, viewer: str) -> bool:
    """
    Check if an email has been read by a viewer (using Email object directly).

    Args:
        email: Email object
        viewer: Viewer name (will be normalized to lowercase)

    Returns:
        True if viewer has read the email, False otherwise
    """
    normalized_viewer = normalize_name(viewer)
    return normalized_viewer in email.read_by


def get_deleted_status(email: Email, viewer: str) -> bool:
    """
    Check if an email has been deleted by a viewer (using Email object directly).

    Args:
        email: Email object
        viewer: Viewer name (will be normalized to lowercase)

    Returns:
        True if viewer has deleted the email, False otherwise
    """
    normalized_viewer = normalize_name(viewer)
    return normalized_viewer in email.deleted_by


# ============================================================================
# Agent Discovery
# ============================================================================

def get_all_known_agents(storage: Optional[EmailStorage] = None) -> List[str]:
    """
    Get all registered agent names from the directory.

    Used for expanding "everyone" recipient to all known agents.

    Args:
        storage: Optional EmailStorage instance (uses singleton if not provided)

    Returns:
        Sorted list of registered agent names
    """
    if storage is None:
        storage = get_storage()

    return sorted(storage.get_registered_agent_names())
