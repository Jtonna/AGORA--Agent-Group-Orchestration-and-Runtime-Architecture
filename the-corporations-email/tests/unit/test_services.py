"""
Unit tests for business logic services.

Tests cover:
- Inbox filtering (agora-12)
- Thread building (agora-13)
- Pagination helpers (agora-14)
- Read/delete status management (agora-15)
"""

import pytest
from datetime import datetime, timezone, timedelta

from models import Email
from storage import EmailStorage, get_storage
from services import (
    # Inbox filtering (agora-12)
    get_inbox_for_viewer,
    filter_emails_for_viewer,
    # Thread building (agora-13)
    find_thread_root,
    find_thread_descendants,
    build_thread,
    # Pagination helpers (agora-14)
    PaginationError,
    validate_page_number,
    paginate,
    paginate_inbox,
    paginate_thread,
    paginate_investigation,
    PAGE_SIZE_INBOX,
    PAGE_SIZE_THREAD,
    PAGE_SIZE_INVESTIGATION,
    # Read/delete status management (agora-15)
    mark_as_read,
    mark_as_deleted,
    is_read_by,
    is_deleted_by,
    get_read_status,
    get_deleted_status,
)


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture(autouse=True)
def reset_storage():
    """Reset storage singleton before and after each test."""
    EmailStorage.reset_instance()
    yield
    EmailStorage.reset_instance()


@pytest.fixture
def storage(tmp_path):
    """Create a fresh storage instance for testing."""
    storage = EmailStorage(str(tmp_path))
    storage.initialize()
    return storage


def make_timestamp(offset_minutes: int = 0) -> str:
    """Create an ISO 8601 timestamp with optional minute offset."""
    dt = datetime.now(timezone.utc) + timedelta(minutes=offset_minutes)
    return dt.strftime("%Y-%m-%dT%H:%M:%SZ")


def create_email(
    to: list,
    from_: str,
    subject: str = "Test Subject",
    content: str = "Test content",
    timestamp: str = None,
    is_response_to: str = None,
    read_by: list = None,
    deleted_by: list = None,
) -> Email:
    """Helper to create Email objects for testing."""
    return Email(
        to=to,
        from_=from_,
        subject=subject,
        content=content,
        timestamp=timestamp or make_timestamp(),
        is_response_to=is_response_to,
        read_by=read_by or [],
        deleted_by=deleted_by or [],
    )


# ============================================================================
# agora-12: Inbox Filtering Tests
# ============================================================================

class TestInboxFiltering:
    """Tests for inbox filtering service."""

    def test_get_inbox_for_viewer_as_recipient(self, storage):
        """Test viewer can see emails they are a recipient of."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        result = get_inbox_for_viewer("alice", storage)
        assert len(result) == 1
        assert result[0].id == email.id

    def test_get_inbox_for_viewer_as_sender(self, storage):
        """Test viewer can see emails they sent."""
        email = create_email(to=["bob"], from_="alice")
        storage.create(email)

        result = get_inbox_for_viewer("alice", storage)
        assert len(result) == 1
        assert result[0].id == email.id

    def test_get_inbox_for_viewer_case_insensitive(self, storage):
        """Test viewer matching is case-insensitive."""
        email = create_email(to=["ALICE"], from_="bob")
        storage.create(email)

        # Both uppercase and lowercase should work
        result = get_inbox_for_viewer("alice", storage)
        assert len(result) == 1

        result = get_inbox_for_viewer("ALICE", storage)
        assert len(result) == 1

        result = get_inbox_for_viewer("Alice", storage)
        assert len(result) == 1

    def test_get_inbox_excludes_deleted_emails(self, storage):
        """Test deleted emails are excluded from inbox."""
        email = create_email(to=["alice"], from_="bob", deleted_by=["alice"])
        storage.create(email)

        result = get_inbox_for_viewer("alice", storage)
        assert len(result) == 0

    def test_get_inbox_shows_deleted_for_others(self, storage):
        """Test email deleted by alice is still visible to bob."""
        email = create_email(to=["alice", "charlie"], from_="bob", deleted_by=["alice"])
        storage.create(email)

        # Alice should not see it
        result = get_inbox_for_viewer("alice", storage)
        assert len(result) == 0

        # Bob should see it (he's the sender)
        result = get_inbox_for_viewer("bob", storage)
        assert len(result) == 1

        # Charlie should see it (he's a recipient)
        result = get_inbox_for_viewer("charlie", storage)
        assert len(result) == 1

    def test_get_inbox_excludes_non_participant(self, storage):
        """Test viewer cannot see emails they are not a participant in."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        result = get_inbox_for_viewer("charlie", storage)
        assert len(result) == 0

    def test_get_inbox_sorted_by_timestamp_descending(self, storage):
        """Test inbox is sorted by timestamp descending (newest first)."""
        email1 = create_email(to=["alice"], from_="bob", timestamp="2024-01-01T10:00:00Z")
        email2 = create_email(to=["alice"], from_="bob", timestamp="2024-01-01T12:00:00Z")
        email3 = create_email(to=["alice"], from_="bob", timestamp="2024-01-01T11:00:00Z")

        storage.create(email1)
        storage.create(email2)
        storage.create(email3)

        result = get_inbox_for_viewer("alice", storage)
        assert len(result) == 3
        assert result[0].id == email2.id  # 12:00 (newest)
        assert result[1].id == email3.id  # 11:00
        assert result[2].id == email1.id  # 10:00 (oldest)

    def test_get_inbox_empty(self, storage):
        """Test empty inbox returns empty list."""
        result = get_inbox_for_viewer("alice", storage)
        assert result == []

    def test_filter_emails_for_viewer(self, storage):
        """Test filter_emails_for_viewer utility function."""
        emails = [
            create_email(to=["alice"], from_="bob"),
            create_email(to=["charlie"], from_="bob"),
            create_email(to=["alice"], from_="charlie", deleted_by=["alice"]),
        ]

        result = filter_emails_for_viewer(emails, "alice")
        assert len(result) == 1
        assert result[0].to == ["alice"]
        assert result[0].from_ == "bob"


# ============================================================================
# agora-13: Thread Building Tests
# ============================================================================

class TestThreadBuilding:
    """Tests for thread building service."""

    def test_find_thread_root_single_email(self, storage):
        """Test finding root of single email (no thread)."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        root = find_thread_root(email.id, storage)
        assert root is not None
        assert root.id == email.id

    def test_find_thread_root_simple_chain(self, storage):
        """Test finding root in simple chain (A <- B <- C)."""
        email_a = create_email(to=["alice"], from_="bob", subject="Root")
        storage.create(email_a)

        email_b = create_email(to=["bob"], from_="alice", is_response_to=email_a.id)
        storage.create(email_b)

        email_c = create_email(to=["alice"], from_="bob", is_response_to=email_b.id)
        storage.create(email_c)

        # All should find email_a as root
        assert find_thread_root(email_a.id, storage).id == email_a.id
        assert find_thread_root(email_b.id, storage).id == email_a.id
        assert find_thread_root(email_c.id, storage).id == email_a.id

    def test_find_thread_root_not_found(self, storage):
        """Test finding root when email doesn't exist."""
        result = find_thread_root("non-existent-id", storage)
        assert result is None

    def test_find_thread_root_orphaned_parent(self, storage):
        """Test finding root when parent doesn't exist (orphan)."""
        email = create_email(
            to=["alice"],
            from_="bob",
            is_response_to="00000000-0000-0000-0000-000000000000"
        )
        storage.create(email)

        # Should return the email itself as root (can't find parent)
        root = find_thread_root(email.id, storage)
        assert root.id == email.id

    def test_find_thread_root_cycle_detection(self, storage):
        """Test cycle detection stops traversal."""
        # Create a circular reference (A points to B, B points to A)
        email_a = create_email(to=["alice"], from_="bob")
        email_b = create_email(to=["bob"], from_="alice")

        storage.create(email_a)
        storage.create(email_b)

        # Manually create cycle (not possible via normal API)
        email_a.is_response_to = email_b.id
        email_b.is_response_to = email_a.id
        storage.update(email_a)
        storage.update(email_b)

        # Should not infinite loop, should return something
        root = find_thread_root(email_a.id, storage)
        assert root is not None

    def test_find_thread_descendants_single_email(self, storage):
        """Test finding descendants of single email."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        descendants = find_thread_descendants(email.id, storage)
        assert len(descendants) == 1
        assert descendants[0].id == email.id

    def test_find_thread_descendants_complex_tree(self, storage):
        """
        Test finding descendants in complex tree structure:

            A (root)
           / \\
          B   C
         / \\
        D   E
        """
        email_a = create_email(to=["alice"], from_="bob", subject="Root")
        storage.create(email_a)

        email_b = create_email(to=["bob"], from_="alice", is_response_to=email_a.id)
        storage.create(email_b)

        email_c = create_email(to=["bob"], from_="charlie", is_response_to=email_a.id)
        storage.create(email_c)

        email_d = create_email(to=["alice"], from_="bob", is_response_to=email_b.id)
        storage.create(email_d)

        email_e = create_email(to=["alice"], from_="charlie", is_response_to=email_b.id)
        storage.create(email_e)

        descendants = find_thread_descendants(email_a.id, storage)
        descendant_ids = {e.id for e in descendants}

        assert len(descendants) == 5
        assert email_a.id in descendant_ids
        assert email_b.id in descendant_ids
        assert email_c.id in descendant_ids
        assert email_d.id in descendant_ids
        assert email_e.id in descendant_ids

    def test_build_thread_excludes_requested_email(self, storage):
        """Test that build_thread excludes the requested email from thread array."""
        email_a = create_email(to=["alice"], from_="bob")
        storage.create(email_a)

        email_b = create_email(to=["bob"], from_="alice", is_response_to=email_a.id)
        storage.create(email_b)

        requested, thread = build_thread(email_a.id, storage)

        assert requested.id == email_a.id
        assert len(thread) == 1
        assert thread[0].id == email_b.id

    def test_build_thread_sorted_by_timestamp(self, storage):
        """Test that thread is sorted by timestamp descending."""
        email_a = create_email(
            to=["alice"], from_="bob", timestamp="2024-01-01T10:00:00Z"
        )
        storage.create(email_a)

        email_b = create_email(
            to=["bob"], from_="alice",
            timestamp="2024-01-01T12:00:00Z",
            is_response_to=email_a.id
        )
        storage.create(email_b)

        email_c = create_email(
            to=["alice"], from_="bob",
            timestamp="2024-01-01T11:00:00Z",
            is_response_to=email_a.id
        )
        storage.create(email_c)

        _, thread = build_thread(email_a.id, storage)

        assert len(thread) == 2
        assert thread[0].id == email_b.id  # 12:00 (newest)
        assert thread[1].id == email_c.id  # 11:00 (oldest)

    def test_build_thread_includes_deleted_emails(self, storage):
        """Test that thread includes emails regardless of delete status."""
        email_a = create_email(to=["alice"], from_="bob")
        storage.create(email_a)

        email_b = create_email(
            to=["bob"], from_="alice",
            is_response_to=email_a.id,
            deleted_by=["bob"]  # Deleted by bob
        )
        storage.create(email_b)

        _, thread = build_thread(email_a.id, storage)

        # Thread should still include the deleted email
        assert len(thread) == 1
        assert thread[0].id == email_b.id

    def test_build_thread_email_not_found(self, storage):
        """Test build_thread when email doesn't exist."""
        requested, thread = build_thread("non-existent-id", storage)

        assert requested is None
        assert thread == []


# ============================================================================
# agora-14: Pagination Tests
# ============================================================================

class TestPagination:
    """Tests for pagination helpers."""

    def test_validate_page_number_valid(self):
        """Test valid page numbers."""
        assert validate_page_number(1) == 1
        assert validate_page_number(5) == 5
        assert validate_page_number(100) == 100
        assert validate_page_number("1") == 1
        assert validate_page_number("10") == 10

    def test_validate_page_number_invalid(self):
        """Test invalid page numbers raise PaginationError."""
        with pytest.raises(PaginationError):
            validate_page_number(0)

        with pytest.raises(PaginationError):
            validate_page_number(-1)

        with pytest.raises(PaginationError):
            validate_page_number("abc")

        with pytest.raises(PaginationError):
            validate_page_number(None)

        with pytest.raises(PaginationError):
            validate_page_number(1.5)

    def test_paginate_basic(self):
        """Test basic pagination."""
        items = list(range(25))  # 25 items

        result = paginate(items, page=1, per_page=10)

        assert len(result["data"]) == 10
        assert result["data"] == list(range(10))
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["per_page"] == 10
        assert result["pagination"]["total_items"] == 25
        assert result["pagination"]["total_pages"] == 3
        assert result["pagination"]["has_next"] is True
        assert result["pagination"]["has_prev"] is False

    def test_paginate_middle_page(self):
        """Test middle page pagination."""
        items = list(range(25))

        result = paginate(items, page=2, per_page=10)

        assert len(result["data"]) == 10
        assert result["data"] == list(range(10, 20))
        assert result["pagination"]["page"] == 2
        assert result["pagination"]["has_next"] is True
        assert result["pagination"]["has_prev"] is True

    def test_paginate_last_page(self):
        """Test last page pagination."""
        items = list(range(25))

        result = paginate(items, page=3, per_page=10)

        assert len(result["data"]) == 5  # Only 5 remaining items
        assert result["data"] == list(range(20, 25))
        assert result["pagination"]["page"] == 3
        assert result["pagination"]["has_next"] is False
        assert result["pagination"]["has_prev"] is True

    def test_paginate_empty_results(self):
        """Test empty results return valid pagination."""
        result = paginate([], page=1, per_page=10)

        assert result["data"] == []
        assert result["pagination"]["page"] == 1
        assert result["pagination"]["per_page"] == 10
        assert result["pagination"]["total_items"] == 0
        assert result["pagination"]["total_pages"] == 1
        assert result["pagination"]["has_next"] is False
        assert result["pagination"]["has_prev"] is False

    def test_paginate_page_exceeds_total(self):
        """Test page exceeding total raises error."""
        items = list(range(25))

        with pytest.raises(PaginationError) as exc_info:
            paginate(items, page=10, per_page=10)

        assert "exceeds total pages" in str(exc_info.value)

    def test_paginate_exact_page_size(self):
        """Test pagination when items exactly fill pages."""
        items = list(range(20))

        result = paginate(items, page=2, per_page=10)

        assert len(result["data"]) == 10
        assert result["pagination"]["total_pages"] == 2
        assert result["pagination"]["has_next"] is False

    def test_paginate_inbox_page_size(self):
        """Test inbox pagination uses correct page size."""
        assert PAGE_SIZE_INBOX == 10

    def test_paginate_thread_page_size(self):
        """Test thread pagination uses correct page size."""
        assert PAGE_SIZE_THREAD == 20

    def test_paginate_investigation_page_size(self):
        """Test investigation pagination uses correct page size."""
        assert PAGE_SIZE_INVESTIGATION == 20

    def test_paginate_inbox_converts_to_dict(self, storage):
        """Test paginate_inbox converts Email objects to dicts."""
        emails = [
            create_email(to=["alice"], from_="bob") for _ in range(5)
        ]

        result = paginate_inbox(emails, 1)

        assert len(result["data"]) == 5
        # Should be dicts, not Email objects
        assert all(isinstance(item, dict) for item in result["data"])
        assert "id" in result["data"][0]
        assert "to" in result["data"][0]

    def test_paginate_thread_converts_to_dict(self, storage):
        """Test paginate_thread converts Email objects to dicts."""
        emails = [
            create_email(to=["alice"], from_="bob") for _ in range(5)
        ]

        result = paginate_thread(emails, 1)

        assert len(result["data"]) == 5
        assert all(isinstance(item, dict) for item in result["data"])


# ============================================================================
# agora-15: Read/Delete Status Management Tests
# ============================================================================

class TestReadDeleteStatus:
    """Tests for read/delete status management."""

    def test_mark_as_read(self, storage):
        """Test marking email as read."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        result = mark_as_read(email.id, "alice", storage)
        assert result is True

        # Verify it was marked
        updated = storage.get_by_id(email.id)
        assert "alice" in updated.read_by

    def test_mark_as_read_case_insensitive(self, storage):
        """Test mark as read normalizes viewer name."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        mark_as_read(email.id, "ALICE", storage)

        updated = storage.get_by_id(email.id)
        assert "alice" in updated.read_by  # Stored as lowercase

    def test_mark_as_read_idempotent(self, storage):
        """Test marking already-read email is idempotent."""
        email = create_email(to=["alice"], from_="bob", read_by=["alice"])
        storage.create(email)

        result = mark_as_read(email.id, "alice", storage)
        assert result is True

        # Should still have just one entry
        updated = storage.get_by_id(email.id)
        assert updated.read_by.count("alice") == 1

    def test_mark_as_read_not_found(self, storage):
        """Test mark as read returns False for non-existent email."""
        result = mark_as_read("non-existent-id", "alice", storage)
        assert result is False

    def test_mark_as_deleted(self, storage):
        """Test marking email as deleted."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        result = mark_as_deleted(email.id, "alice", storage)
        assert result is True

        updated = storage.get_by_id(email.id)
        assert "alice" in updated.deleted_by

    def test_mark_as_deleted_case_insensitive(self, storage):
        """Test mark as deleted normalizes viewer name."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        mark_as_deleted(email.id, "ALICE", storage)

        updated = storage.get_by_id(email.id)
        assert "alice" in updated.deleted_by

    def test_mark_as_deleted_idempotent(self, storage):
        """Test marking already-deleted email is idempotent."""
        email = create_email(to=["alice"], from_="bob", deleted_by=["alice"])
        storage.create(email)

        result = mark_as_deleted(email.id, "alice", storage)
        assert result is True

        updated = storage.get_by_id(email.id)
        assert updated.deleted_by.count("alice") == 1

    def test_mark_as_deleted_not_found(self, storage):
        """Test mark as deleted returns False for non-existent email."""
        result = mark_as_deleted("non-existent-id", "alice", storage)
        assert result is False

    def test_is_read_by_true(self, storage):
        """Test is_read_by returns True when read."""
        email = create_email(to=["alice"], from_="bob", read_by=["alice"])
        storage.create(email)

        result = is_read_by(email.id, "alice", storage)
        assert result is True

    def test_is_read_by_false(self, storage):
        """Test is_read_by returns False when not read."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        result = is_read_by(email.id, "alice", storage)
        assert result is False

    def test_is_read_by_not_found(self, storage):
        """Test is_read_by returns None for non-existent email."""
        result = is_read_by("non-existent-id", "alice", storage)
        assert result is None

    def test_is_read_by_case_insensitive(self, storage):
        """Test is_read_by is case-insensitive."""
        email = create_email(to=["alice"], from_="bob", read_by=["alice"])
        storage.create(email)

        assert is_read_by(email.id, "ALICE", storage) is True
        assert is_read_by(email.id, "Alice", storage) is True

    def test_is_deleted_by_true(self, storage):
        """Test is_deleted_by returns True when deleted."""
        email = create_email(to=["alice"], from_="bob", deleted_by=["alice"])
        storage.create(email)

        result = is_deleted_by(email.id, "alice", storage)
        assert result is True

    def test_is_deleted_by_false(self, storage):
        """Test is_deleted_by returns False when not deleted."""
        email = create_email(to=["alice"], from_="bob")
        storage.create(email)

        result = is_deleted_by(email.id, "alice", storage)
        assert result is False

    def test_is_deleted_by_not_found(self, storage):
        """Test is_deleted_by returns None for non-existent email."""
        result = is_deleted_by("non-existent-id", "alice", storage)
        assert result is None

    def test_get_read_status_direct(self):
        """Test get_read_status with Email object directly."""
        email = create_email(to=["alice"], from_="bob", read_by=["alice"])

        assert get_read_status(email, "alice") is True
        assert get_read_status(email, "bob") is False
        assert get_read_status(email, "ALICE") is True  # Case insensitive

    def test_get_deleted_status_direct(self):
        """Test get_deleted_status with Email object directly."""
        email = create_email(to=["alice"], from_="bob", deleted_by=["alice"])

        assert get_deleted_status(email, "alice") is True
        assert get_deleted_status(email, "bob") is False
        assert get_deleted_status(email, "ALICE") is True  # Case insensitive


# ============================================================================
# Integration Tests (Services working together)
# ============================================================================

class TestServiceIntegration:
    """Tests for services working together."""

    def test_inbox_with_pagination(self, storage):
        """Test getting paginated inbox."""
        # Create 15 emails for alice
        for i in range(15):
            email = create_email(
                to=["alice"],
                from_="bob",
                subject=f"Email {i}",
                timestamp=f"2024-01-01T{10+i:02d}:00:00Z"
            )
            storage.create(email)

        # Get inbox
        inbox = get_inbox_for_viewer("alice", storage)
        assert len(inbox) == 15

        # Paginate first page
        page1 = paginate_inbox(inbox, 1)
        assert len(page1["data"]) == 10
        assert page1["pagination"]["total_pages"] == 2

        # Paginate second page
        page2 = paginate_inbox(inbox, 2)
        assert len(page2["data"]) == 5

    def test_thread_with_status_tracking(self, storage):
        """Test building thread and tracking read status."""
        # Create thread
        root = create_email(to=["alice"], from_="bob", subject="Root")
        storage.create(root)

        reply = create_email(to=["bob"], from_="alice", is_response_to=root.id)
        storage.create(reply)

        # Mark root as read
        mark_as_read(root.id, "alice", storage)

        # Build thread
        requested, thread = build_thread(root.id, storage)

        # Verify read status
        assert is_read_by(root.id, "alice", storage) is True
        assert is_read_by(reply.id, "alice", storage) is False

    def test_delete_removes_from_inbox_but_keeps_in_thread(self, storage):
        """Test that deleted emails are excluded from inbox but included in thread."""
        # Create thread
        root = create_email(to=["alice"], from_="bob")
        storage.create(root)

        reply = create_email(to=["bob"], from_="alice", is_response_to=root.id)
        storage.create(reply)

        # Alice deletes root
        mark_as_deleted(root.id, "alice", storage)

        # Root should not appear in alice's inbox
        inbox = get_inbox_for_viewer("alice", storage)
        inbox_ids = {e.id for e in inbox}
        assert root.id not in inbox_ids

        # But reply should still be in inbox
        assert reply.id in inbox_ids

        # Thread from reply should still include root
        _, thread = build_thread(reply.id, storage)
        thread_ids = {e.id for e in thread}
        assert root.id in thread_ids

    def test_complex_scenario(self, storage):
        """Test complex scenario with multiple users and operations."""
        # Create a conversation between alice, bob, and charlie
        msg1 = create_email(
            to=["alice", "charlie"],
            from_="bob",
            subject="Project update",
            timestamp="2024-01-01T10:00:00Z"
        )
        storage.create(msg1)

        msg2 = create_email(
            to=["bob", "charlie"],
            from_="alice",
            subject="Re: Project update",
            timestamp="2024-01-01T11:00:00Z",
            is_response_to=msg1.id
        )
        storage.create(msg2)

        msg3 = create_email(
            to=["alice", "bob"],
            from_="charlie",
            subject="Re: Project update",
            timestamp="2024-01-01T12:00:00Z",
            is_response_to=msg2.id
        )
        storage.create(msg3)

        # Alice reads msg1 and msg2
        mark_as_read(msg1.id, "alice", storage)
        mark_as_read(msg2.id, "alice", storage)

        # Bob deletes msg1
        mark_as_deleted(msg1.id, "bob", storage)

        # Verify alice's inbox (should see all 3, sorted by timestamp desc)
        alice_inbox = get_inbox_for_viewer("alice", storage)
        assert len(alice_inbox) == 3
        assert alice_inbox[0].id == msg3.id  # 12:00
        assert alice_inbox[1].id == msg2.id  # 11:00
        assert alice_inbox[2].id == msg1.id  # 10:00

        # Verify bob's inbox (should see only 2, msg1 is deleted)
        bob_inbox = get_inbox_for_viewer("bob", storage)
        assert len(bob_inbox) == 2
        assert msg1.id not in [e.id for e in bob_inbox]

        # Verify thread from any message includes all 3
        _, thread = build_thread(msg3.id, storage)
        assert len(thread) == 2  # Excludes msg3 itself
        thread_ids = {e.id for e in thread}
        assert msg1.id in thread_ids
        assert msg2.id in thread_ids

        # Verify read status
        assert is_read_by(msg1.id, "alice", storage) is True
        assert is_read_by(msg3.id, "alice", storage) is False
        assert is_read_by(msg1.id, "bob", storage) is False

        # Verify delete status
        assert is_deleted_by(msg1.id, "bob", storage) is True
        assert is_deleted_by(msg1.id, "alice", storage) is False
