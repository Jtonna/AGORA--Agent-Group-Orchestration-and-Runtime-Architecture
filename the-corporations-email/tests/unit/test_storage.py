"""
Unit tests for JSON storage operations.

Tests cover:
- JSON read/write operations
- File creation when not exists
- Data integrity after write
- Startup validation scenarios
- Quarantine logic (recoverable vs unrecoverable)
- Singleton pattern verification
- Error handling for corrupt files
"""

import json
import os
import pytest
import tempfile
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from unittest.mock import patch, MagicMock

import sys
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from storage import EmailStorage, StorageError, StorageInitError, get_storage
from models import Email, generate_uuid


class TestSingletonPattern:
    """Tests for the singleton pattern implementation."""

    def test_singleton_returns_same_instance(self, temp_data_dir):
        """Test that multiple calls return the same instance."""
        EmailStorage.reset_instance()

        storage1 = EmailStorage(temp_data_dir)
        storage2 = EmailStorage(temp_data_dir)

        assert storage1 is storage2

    def test_get_storage_returns_singleton(self, temp_data_dir):
        """Test that get_storage returns the singleton instance."""
        EmailStorage.reset_instance()

        storage1 = get_storage(temp_data_dir)
        storage2 = get_storage()

        assert storage1 is storage2

    def test_reset_instance_creates_new_instance(self, temp_data_dir):
        """Test that reset_instance allows creating a new instance."""
        EmailStorage.reset_instance()
        storage1 = EmailStorage(temp_data_dir)

        EmailStorage.reset_instance()
        storage2 = EmailStorage(temp_data_dir)

        # They should be different objects after reset
        assert storage1 is not storage2

    def test_singleton_thread_safety(self, temp_data_dir):
        """Test that singleton is thread-safe."""
        EmailStorage.reset_instance()
        instances = []
        errors = []

        def get_instance():
            try:
                instance = EmailStorage(temp_data_dir)
                instances.append(instance)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=get_instance) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        # All instances should be the same object
        assert all(inst is instances[0] for inst in instances)


class TestFileCreation:
    """Tests for file creation when files don't exist."""

    def test_creates_data_directory(self, temp_data_dir):
        """Test that data directory is created if it doesn't exist."""
        EmailStorage.reset_instance()
        data_dir = os.path.join(temp_data_dir, "nested", "data")

        storage = EmailStorage(data_dir)
        storage.initialize()

        assert os.path.exists(data_dir)

    def test_creates_emails_json_if_not_exists(self, temp_data_dir):
        """Test that emails.json is created with correct structure."""
        EmailStorage.reset_instance()
        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        assert os.path.exists(emails_path)

        with open(emails_path, 'r') as f:
            data = json.load(f)

        assert data == {"version": 1, "emails": []}

    def test_creates_quarantine_json_if_not_exists(self, temp_data_dir):
        """Test that quarantine.json is created with correct structure."""
        EmailStorage.reset_instance()
        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        quarantine_path = os.path.join(temp_data_dir, "quarantine.json")
        assert os.path.exists(quarantine_path)

        with open(quarantine_path, 'r') as f:
            data = json.load(f)

        assert data == {"version": 1, "quarantined": []}


class TestJsonReadWrite:
    """Tests for JSON read/write operations."""

    def test_write_and_read_email(self, initialized_storage):
        """Test that emails are persisted to file correctly."""
        storage = initialized_storage

        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test Subject",
            content="Test Content"
        )

        storage.create(email)

        # Read the file directly to verify
        emails_path = storage._emails_path
        with open(emails_path, 'r') as f:
            data = json.load(f)

        assert len(data["emails"]) == 1
        assert data["emails"][0]["id"] == email.id
        assert data["emails"][0]["to"] == ["alice"]
        assert data["emails"][0]["from"] == "bob"
        assert data["emails"][0]["subject"] == "Test Subject"
        assert data["emails"][0]["content"] == "Test Content"

    def test_data_integrity_after_multiple_writes(self, initialized_storage):
        """Test that data integrity is maintained after multiple writes."""
        storage = initialized_storage

        # Create multiple emails
        emails = []
        for i in range(5):
            email = Email(
                to=[f"recipient{i}"],
                from_=f"sender{i}",
                subject=f"Subject {i}",
                content=f"Content {i}"
            )
            storage.create(email)
            emails.append(email)

        # Verify all emails exist
        for email in emails:
            retrieved = storage.get_by_id(email.id)
            assert retrieved is not None
            assert retrieved.id == email.id
            assert retrieved.to == email.to

    def test_update_persists_to_file(self, initialized_storage):
        """Test that updates are persisted to file."""
        storage = initialized_storage

        email = Email(
            to=["alice"],
            from_="bob",
            subject="Original Subject",
            content="Original Content"
        )
        storage.create(email)

        # Update the email
        email.mark_read_by("alice")
        storage.update(email)

        # Read file directly
        with open(storage._emails_path, 'r') as f:
            data = json.load(f)

        assert "alice" in data["emails"][0]["readBy"]

    def test_delete_persists_to_file(self, initialized_storage):
        """Test that deletes are persisted to file."""
        storage = initialized_storage

        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Test"
        )
        storage.create(email)
        email_id = email.id

        # Delete the email
        storage.delete(email_id)

        # Read file directly
        with open(storage._emails_path, 'r') as f:
            data = json.load(f)

        assert len(data["emails"]) == 0


class TestStartupValidation:
    """Tests for startup validation scenarios."""

    def test_invalid_json_raises_error(self, temp_data_dir):
        """Test that invalid JSON in emails.json raises StorageInitError."""
        EmailStorage.reset_instance()

        # Create invalid JSON file
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            f.write("{ invalid json }")

        storage = EmailStorage(temp_data_dir)

        with pytest.raises(StorageInitError) as exc_info:
            storage.initialize()

        assert "invalid" in str(exc_info.value).lower()

    def test_missing_version_field_raises_error(self, temp_data_dir):
        """Test that missing version field raises StorageInitError."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({"emails": []}, f)

        storage = EmailStorage(temp_data_dir)

        with pytest.raises(StorageInitError) as exc_info:
            storage.initialize()

        assert "version" in str(exc_info.value).lower()

    def test_unsupported_version_backups_and_creates_fresh(self, temp_data_dir):
        """Test that unsupported version creates backup and fresh file."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({"version": 999, "emails": []}, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        # Check backup was created
        backup_files = [f for f in os.listdir(temp_data_dir) if "emails.json.old" in f]
        assert len(backup_files) == 1

        # Check new file has correct structure
        with open(emails_path, 'r') as f:
            data = json.load(f)
        assert data["version"] == 1
        assert data["emails"] == []

    def test_string_version_converted_to_int(self, temp_data_dir):
        """Test that string version '1' is converted to integer 1."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({"version": "1", "emails": []}, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        # Verify version is now integer
        with open(emails_path, 'r') as f:
            data = json.load(f)
        assert data["version"] == 1
        assert isinstance(data["version"], int)

    def test_missing_emails_key_defaults_to_empty_array(self, temp_data_dir):
        """Test that missing emails key is recovered."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({"version": 1}, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert storage.get_all() == []

    def test_invalid_quarantine_backups_and_creates_fresh(self, temp_data_dir):
        """Test that invalid quarantine.json creates backup and fresh file."""
        EmailStorage.reset_instance()

        os.makedirs(temp_data_dir, exist_ok=True)

        # Create valid emails.json
        emails_path = os.path.join(temp_data_dir, "emails.json")
        with open(emails_path, 'w') as f:
            json.dump({"version": 1, "emails": []}, f)

        # Create invalid quarantine.json
        quarantine_path = os.path.join(temp_data_dir, "quarantine.json")
        with open(quarantine_path, 'w') as f:
            f.write("{ invalid }")

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        # Check backup was created
        backup_files = [f for f in os.listdir(temp_data_dir) if "quarantine.json.bak" in f]
        assert len(backup_files) == 1

        # Check new file has correct structure
        with open(quarantine_path, 'r') as f:
            data = json.load(f)
        assert data["version"] == 1
        assert data["quarantined"] == []

    def test_loads_valid_emails(self, temp_data_dir):
        """Test that valid emails are loaded correctly."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "isResponseTo": None,
                    "readBy": [],
                    "deletedBy": []
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        emails = storage.get_all()
        assert len(emails) == 1
        assert emails[0].id == email_id


class TestRecoverableIssues:
    """Tests for auto-fixing recoverable issues."""

    def test_normalizes_names_to_lowercase(self, temp_data_dir):
        """Test that names are normalized to lowercase."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["ALICE", "Bob"],
                    "from": "CHARLIE",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "readBy": ["ALICE"],
                    "deletedBy": ["BOB"]
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        email = storage.get_by_id(email_id)
        assert email.to == ["alice", "bob"]
        assert email.from_ == "charlie"
        assert email.read_by == ["alice"]
        assert email.deleted_by == ["bob"]

    def test_trims_whitespace(self, temp_data_dir):
        """Test that strings are trimmed."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["  alice  "],
                    "from": "  bob  ",
                    "subject": "  Test Subject  ",
                    "content": "  Content  ",
                    "timestamp": "2024-01-15T10:30:00Z"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        email = storage.get_by_id(email_id)
        assert email.to == ["alice"]
        assert email.from_ == "bob"
        assert email.subject == "Test Subject"
        assert email.content == "Content"

    def test_adds_missing_readBy_deletedBy(self, temp_data_dir):
        """Test that missing readBy and deletedBy default to []."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        email = storage.get_by_id(email_id)
        assert email.read_by == []
        assert email.deleted_by == []

    def test_filters_non_strings_from_readBy(self, temp_data_dir):
        """Test that non-strings are filtered from readBy."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "readBy": ["alice", 123, None, "bob"],
                    "deletedBy": []
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        email = storage.get_by_id(email_id)
        assert email.read_by == ["alice", "bob"]

    def test_deduplicates_names(self, temp_data_dir):
        """Test that duplicate names are removed."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["alice", "Alice", "ALICE", "bob"],
                    "from": "charlie",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "readBy": ["alice", "ALICE"],
                    "deletedBy": ["bob", "Bob"]
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        email = storage.get_by_id(email_id)
        assert email.to == ["alice", "bob"]
        assert email.read_by == ["alice"]
        assert email.deleted_by == ["bob"]

    def test_strips_extra_fields(self, temp_data_dir):
        """Test that extra fields are stripped silently."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "extraField": "should be stripped",
                    "anotherExtra": 123,
                    "readBy": [],
                    "deletedBy": []
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        # Verify email is valid
        email = storage.get_by_id(email_id)
        assert email is not None

        # Verify extra fields are not in the saved file
        with open(emails_path, 'r') as f:
            data = json.load(f)
        assert "extraField" not in data["emails"][0]
        assert "anotherExtra" not in data["emails"][0]


class TestUnrecoverableIssues:
    """Tests for quarantining unrecoverable issues."""

    def test_quarantines_missing_required_fields(self, temp_data_dir):
        """Test that emails missing required fields are quarantined."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": generate_uuid(),
                    "to": ["alice"],
                    # Missing 'from', 'subject', 'content', 'timestamp'
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert len(storage.get_all()) == 0
        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert "missing required field" in quarantined[0]["reason"]

    def test_quarantines_wrong_field_types(self, temp_data_dir):
        """Test that emails with wrong field types are quarantined."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": generate_uuid(),
                    "to": "alice",  # Should be array
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert len(storage.get_all()) == 0
        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert "must be an array" in quarantined[0]["reason"]

    def test_quarantines_invalid_uuid_id(self, temp_data_dir):
        """Test that emails with invalid UUID for id are quarantined."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": "not-a-valid-uuid",
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert len(storage.get_all()) == 0
        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert "invalid UUID" in quarantined[0]["reason"]

    def test_quarantines_invalid_uuid_isResponseTo(self, temp_data_dir):
        """Test that emails with invalid UUID for isResponseTo are quarantined."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": generate_uuid(),
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "isResponseTo": "invalid-uuid"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert len(storage.get_all()) == 0
        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert "isResponseTo" in quarantined[0]["reason"]

    def test_quarantines_invalid_timestamp(self, temp_data_dir):
        """Test that emails with invalid timestamp are quarantined."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": generate_uuid(),
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "not-a-timestamp"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert len(storage.get_all()) == 0
        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert "timestamp" in quarantined[0]["reason"]

    def test_quarantines_duplicate_ids(self, temp_data_dir):
        """Test that all emails with duplicate IDs are quarantined."""
        EmailStorage.reset_instance()

        duplicate_id = generate_uuid()
        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [
                    {
                        "id": duplicate_id,
                        "to": ["alice"],
                        "from": "bob",
                        "subject": "Test 1",
                        "content": "Content 1",
                        "timestamp": "2024-01-15T10:30:00Z"
                    },
                    {
                        "id": duplicate_id,
                        "to": ["charlie"],
                        "from": "dave",
                        "subject": "Test 2",
                        "content": "Content 2",
                        "timestamp": "2024-01-15T11:30:00Z"
                    }
                ]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        assert len(storage.get_all()) == 0
        quarantined = storage.get_quarantined()
        assert len(quarantined) == 2
        for q in quarantined:
            assert "duplicate id" in q["reason"]


class TestOrphanedReferences:
    """Tests for orphaned isResponseTo references."""

    def test_leaves_orphaned_references_unchanged(self, temp_data_dir):
        """Test that orphaned isResponseTo references are left unchanged."""
        EmailStorage.reset_instance()

        email_id = generate_uuid()
        orphaned_ref = generate_uuid()  # Reference to non-existent email

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": email_id,
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z",
                    "isResponseTo": orphaned_ref
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        email = storage.get_by_id(email_id)
        assert email is not None
        assert email.is_response_to == orphaned_ref  # Reference is preserved


class TestDatabaseMethods:
    """Tests for database-like CRUD methods."""

    def test_get_all_empty(self, initialized_storage):
        """Test get_all on empty storage."""
        assert initialized_storage.get_all() == []

    def test_get_all_with_emails(self, initialized_storage):
        """Test get_all returns all emails."""
        storage = initialized_storage

        email1 = Email(to=["alice"], from_="bob", subject="Test 1", content="Content 1")
        email2 = Email(to=["charlie"], from_="dave", subject="Test 2", content="Content 2")

        storage.create(email1)
        storage.create(email2)

        emails = storage.get_all()
        assert len(emails) == 2
        ids = [e.id for e in emails]
        assert email1.id in ids
        assert email2.id in ids

    def test_get_by_id_found(self, initialized_storage):
        """Test get_by_id returns email when found."""
        storage = initialized_storage

        email = Email(to=["alice"], from_="bob", subject="Test", content="Content")
        storage.create(email)

        retrieved = storage.get_by_id(email.id)
        assert retrieved is not None
        assert retrieved.id == email.id

    def test_get_by_id_not_found(self, initialized_storage):
        """Test get_by_id returns None when not found."""
        storage = initialized_storage

        retrieved = storage.get_by_id(generate_uuid())
        assert retrieved is None

    def test_create_returns_email(self, initialized_storage):
        """Test create returns the created email."""
        storage = initialized_storage

        email = Email(to=["alice"], from_="bob", subject="Test", content="Content")
        created = storage.create(email)

        assert created.id == email.id

    def test_update_found(self, initialized_storage):
        """Test update returns updated email when found."""
        storage = initialized_storage

        email = Email(to=["alice"], from_="bob", subject="Test", content="Content")
        storage.create(email)

        email.mark_read_by("alice")
        updated = storage.update(email)

        assert updated is not None
        assert "alice" in updated.read_by

    def test_update_not_found(self, initialized_storage):
        """Test update returns None when email not found."""
        storage = initialized_storage

        email = Email(to=["alice"], from_="bob", subject="Test", content="Content")
        # Don't create - try to update non-existent email

        updated = storage.update(email)
        assert updated is None

    def test_delete_found(self, initialized_storage):
        """Test delete returns True when email found and deleted."""
        storage = initialized_storage

        email = Email(to=["alice"], from_="bob", subject="Test", content="Content")
        storage.create(email)

        deleted = storage.delete(email.id)
        assert deleted is True
        assert storage.get_by_id(email.id) is None

    def test_delete_not_found(self, initialized_storage):
        """Test delete returns False when email not found."""
        storage = initialized_storage

        deleted = storage.delete(generate_uuid())
        assert deleted is False

    def test_exists_true(self, initialized_storage):
        """Test exists returns True when email exists."""
        storage = initialized_storage

        email = Email(to=["alice"], from_="bob", subject="Test", content="Content")
        storage.create(email)

        assert storage.exists(email.id) is True

    def test_exists_false(self, initialized_storage):
        """Test exists returns False when email doesn't exist."""
        storage = initialized_storage

        assert storage.exists(generate_uuid()) is False


class TestQuarantineMethods:
    """Tests for quarantine-related methods."""

    def test_get_quarantined_empty(self, initialized_storage):
        """Test get_quarantined returns empty list initially."""
        assert initialized_storage.get_quarantined() == []

    def test_add_to_quarantine(self, initialized_storage):
        """Test add_to_quarantine adds entry."""
        storage = initialized_storage

        email_data = {"id": "test", "to": "invalid"}
        storage.add_to_quarantine(email_data, "test reason")

        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert quarantined[0]["original"] == email_data
        assert quarantined[0]["reason"] == "test reason"
        assert "quarantined_at" in quarantined[0]


class TestThreadSafety:
    """Tests for thread-safe operations."""

    def test_concurrent_reads(self, initialized_storage):
        """Test concurrent read operations."""
        storage = initialized_storage

        # Create some emails
        for i in range(10):
            email = Email(to=[f"recipient{i}"], from_="sender", subject="Test", content="Content")
            storage.create(email)

        results = []
        errors = []

        def read_all():
            try:
                emails = storage.get_all()
                results.append(len(emails))
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=read_all) for _ in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert all(r == 10 for r in results)

    def test_concurrent_writes(self, initialized_storage):
        """Test concurrent write operations."""
        storage = initialized_storage

        errors = []

        def create_email(index):
            try:
                email = Email(to=[f"recipient{index}"], from_="sender", subject=f"Test {index}", content="Content")
                storage.create(email)
            except Exception as e:
                errors.append(e)

        threads = [threading.Thread(target=create_email, args=(i,)) for i in range(10)]
        for t in threads:
            t.start()
        for t in threads:
            t.join()

        assert len(errors) == 0
        assert len(storage.get_all()) == 10


class TestErrorHandling:
    """Tests for error handling scenarios."""

    def test_handles_emails_field_not_array(self, temp_data_dir):
        """Test that non-array emails field raises error."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({"version": 1, "emails": "not an array"}, f)

        storage = EmailStorage(temp_data_dir)

        with pytest.raises(StorageInitError) as exc_info:
            storage.initialize()

        assert "not an array" in str(exc_info.value)

    def test_quarantine_entry_has_timestamp(self, temp_data_dir):
        """Test that quarantine entries have timestamps."""
        EmailStorage.reset_instance()

        emails_path = os.path.join(temp_data_dir, "emails.json")
        os.makedirs(temp_data_dir, exist_ok=True)
        with open(emails_path, 'w') as f:
            json.dump({
                "version": 1,
                "emails": [{
                    "id": "invalid-uuid",
                    "to": ["alice"],
                    "from": "bob",
                    "subject": "Test",
                    "content": "Content",
                    "timestamp": "2024-01-15T10:30:00Z"
                }]
            }, f)

        storage = EmailStorage(temp_data_dir)
        storage.initialize()

        quarantined = storage.get_quarantined()
        assert len(quarantined) == 1
        assert "quarantined_at" in quarantined[0]
        # Verify timestamp format
        timestamp = quarantined[0]["quarantined_at"]
        assert timestamp.endswith("Z")


# Fixtures

@pytest.fixture
def temp_data_dir():
    """Create a temporary directory for test data."""
    import tempfile
    import shutil

    temp_dir = tempfile.mkdtemp()
    yield temp_dir

    # Cleanup
    EmailStorage.reset_instance()
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def initialized_storage(temp_data_dir):
    """Create and initialize a storage instance."""
    EmailStorage.reset_instance()
    storage = EmailStorage(temp_data_dir)
    storage.initialize()
    return storage
