"""
Unit tests for Email model and validation functions.
"""

import pytest
import uuid
import re
from models import (
    Email,
    normalize_name,
    normalize_name_list,
    validate_uuid,
    generate_uuid,
    generate_timestamp,
    validate_name,
    validate_name_list,
    validate_email_data,
    check_unknown_fields,
    ALLOWED_EMAIL_FIELDS
)


class TestNormalizeName:
    """Tests for the normalize_name function."""

    def test_lowercase_conversion(self):
        """Names should be converted to lowercase."""
        assert normalize_name("Alice") == "alice"
        assert normalize_name("ALICE") == "alice"
        assert normalize_name("AlIcE") == "alice"

    def test_whitespace_trimming(self):
        """Leading and trailing whitespace should be trimmed."""
        assert normalize_name("  alice  ") == "alice"
        assert normalize_name("\talice\n") == "alice"
        assert normalize_name("   alice") == "alice"
        assert normalize_name("alice   ") == "alice"

    def test_combined_normalization(self):
        """Both lowercase and trimming should work together."""
        assert normalize_name("  ALICE  ") == "alice"
        assert normalize_name("\tBOB\n") == "bob"

    def test_empty_string(self):
        """Empty string should return empty string."""
        assert normalize_name("") == ""
        assert normalize_name("   ") == ""

    def test_non_string_raises_error(self):
        """Non-string input should raise ValueError."""
        with pytest.raises(ValueError):
            normalize_name(123)
        with pytest.raises(ValueError):
            normalize_name(None)
        with pytest.raises(ValueError):
            normalize_name(["alice"])


class TestNormalizeNameList:
    """Tests for the normalize_name_list function."""

    def test_normalizes_all_names(self):
        """All names in the list should be normalized."""
        result = normalize_name_list(["Alice", "  BOB  ", "Charlie"])
        assert result == ["alice", "bob", "charlie"]

    def test_removes_duplicates(self):
        """Duplicate names should be removed."""
        result = normalize_name_list(["alice", "Alice", "ALICE"])
        assert result == ["alice"]

    def test_preserves_order(self):
        """First occurrence of each name should be preserved."""
        result = normalize_name_list(["bob", "alice", "Bob", "charlie"])
        assert result == ["bob", "alice", "charlie"]

    def test_removes_empty_strings(self):
        """Empty strings should be filtered out."""
        result = normalize_name_list(["alice", "", "bob", "   "])
        assert result == ["alice", "bob"]

    def test_empty_list(self):
        """Empty list should return empty list."""
        assert normalize_name_list([]) == []

    def test_non_list_raises_error(self):
        """Non-list input should raise ValueError."""
        with pytest.raises(ValueError):
            normalize_name_list("alice")
        with pytest.raises(ValueError):
            normalize_name_list({"name": "alice"})


class TestValidateUuid:
    """Tests for the validate_uuid function."""

    def test_valid_uuid(self):
        """Valid UUID strings should return True."""
        assert validate_uuid("550e8400-e29b-41d4-a716-446655440000") is True
        assert validate_uuid(str(uuid.uuid4())) is True

    def test_invalid_uuid(self):
        """Invalid UUID strings should return False."""
        assert validate_uuid("not-a-uuid") is False
        assert validate_uuid("12345") is False
        assert validate_uuid("") is False

    def test_non_string_returns_false(self):
        """Non-string input should return False."""
        assert validate_uuid(123) is False
        assert validate_uuid(None) is False
        assert validate_uuid(["uuid"]) is False


class TestGenerateUuid:
    """Tests for the generate_uuid function."""

    def test_returns_valid_uuid(self):
        """Generated UUID should be valid."""
        generated = generate_uuid()
        assert validate_uuid(generated) is True

    def test_returns_string(self):
        """Generated UUID should be a string."""
        generated = generate_uuid()
        assert isinstance(generated, str)

    def test_generates_unique_values(self):
        """Each call should generate a unique UUID."""
        uuids = [generate_uuid() for _ in range(100)]
        assert len(set(uuids)) == 100


class TestGenerateTimestamp:
    """Tests for the generate_timestamp function."""

    def test_returns_string(self):
        """Timestamp should be a string."""
        ts = generate_timestamp()
        assert isinstance(ts, str)

    def test_iso8601_format(self):
        """Timestamp should be in ISO 8601 format with Z suffix."""
        ts = generate_timestamp()
        # Pattern: YYYY-MM-DDTHH:MM:SSZ
        pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
        assert re.match(pattern, ts) is not None

    def test_ends_with_z(self):
        """Timestamp should end with Z for UTC."""
        ts = generate_timestamp()
        assert ts.endswith("Z")


class TestValidateName:
    """Tests for the validate_name function."""

    def test_valid_names(self):
        """Valid names should return True."""
        assert validate_name("alice") is True
        assert validate_name("  bob  ") is True
        assert validate_name("CHARLIE") is True

    def test_empty_name(self):
        """Empty or whitespace-only names should return False."""
        assert validate_name("") is False
        assert validate_name("   ") is False
        assert validate_name("\t\n") is False

    def test_non_string_returns_false(self):
        """Non-string input should return False."""
        assert validate_name(123) is False
        assert validate_name(None) is False


class TestValidateNameList:
    """Tests for the validate_name_list function."""

    def test_valid_list(self):
        """Valid name list should return True."""
        assert validate_name_list(["alice", "bob"]) is True

    def test_empty_list(self):
        """Empty list should return False."""
        assert validate_name_list([]) is False

    def test_list_with_invalid_names(self):
        """List with invalid names should return False."""
        assert validate_name_list(["alice", ""]) is False
        assert validate_name_list(["   ", "bob"]) is False

    def test_non_list_returns_false(self):
        """Non-list input should return False."""
        assert validate_name_list("alice") is False


class TestEmailCreation:
    """Tests for Email model creation."""

    def test_basic_email_creation(self, sample_email_data):
        """Email should be created with valid data."""
        email = Email(
            to=sample_email_data["to"],
            from_=sample_email_data["from"],
            subject=sample_email_data["subject"],
            content=sample_email_data["content"]
        )
        assert email.to == ["alice", "bob"]
        assert email.from_ == "charlie"
        assert email.subject == "Test Subject"
        assert email.content == "Test content body"

    def test_auto_generates_uuid(self):
        """Email should auto-generate a valid UUID."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        assert validate_uuid(email.id) is True

    def test_auto_generates_timestamp(self):
        """Email should auto-generate a valid timestamp."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        pattern = r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$"
        assert re.match(pattern, email.timestamp) is not None

    def test_normalizes_sender(self):
        """Sender name should be normalized."""
        email = Email(
            to=["alice"],
            from_="  BOB  ",
            subject="Test",
            content="Content"
        )
        assert email.from_ == "bob"

    def test_normalizes_recipients(self):
        """Recipient names should be normalized."""
        email = Email(
            to=["  ALICE  ", "BOB"],
            from_="charlie",
            subject="Test",
            content="Content"
        )
        assert email.to == ["alice", "bob"]

    def test_deduplicates_recipients(self):
        """Duplicate recipients should be removed."""
        email = Email(
            to=["alice", "Alice", "ALICE", "bob"],
            from_="charlie",
            subject="Test",
            content="Content"
        )
        assert email.to == ["alice", "bob"]

    def test_empty_recipients_raises_error(self):
        """Empty recipients list should raise ValueError."""
        with pytest.raises(ValueError, match="at least one recipient"):
            Email(
                to=[],
                from_="bob",
                subject="Test",
                content="Content"
            )

    def test_empty_sender_raises_error(self):
        """Empty sender should raise ValueError."""
        with pytest.raises(ValueError, match="must have a sender"):
            Email(
                to=["alice"],
                from_="   ",
                subject="Test",
                content="Content"
            )

    def test_invalid_is_response_to_raises_error(self):
        """Invalid UUID for is_response_to should raise ValueError."""
        with pytest.raises(ValueError, match="Invalid UUID"):
            Email(
                to=["alice"],
                from_="bob",
                subject="Test",
                content="Content",
                is_response_to="not-a-uuid"
            )

    def test_valid_is_response_to(self):
        """Valid UUID for is_response_to should be accepted."""
        parent_id = generate_uuid()
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content",
            is_response_to=parent_id
        )
        assert email.is_response_to == parent_id


class TestEmailToDict:
    """Tests for Email.to_dict method."""

    def test_to_dict_keys(self):
        """to_dict should return all expected keys."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        d = email.to_dict()
        expected_keys = {"id", "to", "from", "subject", "content",
                        "timestamp", "isResponseTo", "readBy", "deletedBy"}
        assert set(d.keys()) == expected_keys

    def test_to_dict_values(self):
        """to_dict should return correct values."""
        email = Email(
            to=["alice", "bob"],
            from_="charlie",
            subject="Test Subject",
            content="Test Content"
        )
        d = email.to_dict()
        assert d["to"] == ["alice", "bob"]
        assert d["from"] == "charlie"
        assert d["subject"] == "Test Subject"
        assert d["content"] == "Test Content"
        assert d["isResponseTo"] is None
        assert d["readBy"] == []
        assert d["deletedBy"] == []


class TestEmailFromDict:
    """Tests for Email.from_dict method."""

    def test_from_dict_basic(self):
        """from_dict should create Email from dictionary."""
        data = {
            "to": ["alice"],
            "from": "bob",
            "subject": "Test",
            "content": "Content"
        }
        email = Email.from_dict(data)
        assert email.to == ["alice"]
        assert email.from_ == "bob"
        assert email.subject == "Test"
        assert email.content == "Content"

    def test_from_dict_with_all_fields(self):
        """from_dict should handle all fields."""
        email_id = generate_uuid()
        data = {
            "id": email_id,
            "to": ["alice", "bob"],
            "from": "charlie",
            "subject": "Test Subject",
            "content": "Test Content",
            "timestamp": "2024-01-15T10:30:00Z",
            "isResponseTo": None,
            "readBy": ["alice"],
            "deletedBy": []
        }
        email = Email.from_dict(data)
        assert email.id == email_id
        assert email.read_by == ["alice"]


class TestEmailParticipants:
    """Tests for Email participant methods."""

    def test_get_participants(self):
        """get_participants should return sender and recipients."""
        email = Email(
            to=["alice", "bob"],
            from_="charlie",
            subject="Test",
            content="Content"
        )
        participants = email.get_participants()
        assert "alice" in participants
        assert "bob" in participants
        assert "charlie" in participants

    def test_is_participant_true(self):
        """is_participant should return True for participants."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        assert email.is_participant("alice") is True
        assert email.is_participant("bob") is True
        assert email.is_participant("ALICE") is True  # Case insensitive
        assert email.is_participant("  bob  ") is True  # Whitespace tolerant

    def test_is_participant_false(self):
        """is_participant should return False for non-participants."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        assert email.is_participant("charlie") is False


class TestEmailReadBy:
    """Tests for Email read tracking."""

    def test_mark_read_by(self):
        """mark_read_by should add user to read_by list."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        email.mark_read_by("alice")
        assert "alice" in email.read_by

    def test_mark_read_by_normalizes_name(self):
        """mark_read_by should normalize name."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        email.mark_read_by("  ALICE  ")
        assert "alice" in email.read_by

    def test_mark_read_by_no_duplicates(self):
        """mark_read_by should not add duplicates."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        email.mark_read_by("alice")
        email.mark_read_by("Alice")
        email.mark_read_by("ALICE")
        assert email.read_by.count("alice") == 1


class TestEmailDeletedBy:
    """Tests for Email deletion tracking."""

    def test_mark_deleted_by(self):
        """mark_deleted_by should add user to deleted_by list."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        email.mark_deleted_by("alice")
        assert "alice" in email.deleted_by

    def test_is_deleted_for(self):
        """is_deleted_for should return correct status."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        assert email.is_deleted_for("alice") is False
        email.mark_deleted_by("alice")
        assert email.is_deleted_for("alice") is True
        assert email.is_deleted_for("ALICE") is True  # Case insensitive

    def test_mark_deleted_by_no_duplicates(self):
        """mark_deleted_by should not add duplicates."""
        email = Email(
            to=["alice"],
            from_="bob",
            subject="Test",
            content="Content"
        )
        email.mark_deleted_by("alice")
        email.mark_deleted_by("Alice")
        assert email.deleted_by.count("alice") == 1


class TestValidateEmailData:
    """Tests for validate_email_data function."""

    def test_valid_data(self, sample_email_data):
        """Valid email data should return no errors."""
        errors = validate_email_data(sample_email_data)
        assert errors == []

    def test_missing_required_fields(self):
        """Missing required fields should be reported."""
        errors = validate_email_data({})
        assert len(errors) == 4
        assert any("'to'" in e for e in errors)
        assert any("'from'" in e for e in errors)
        assert any("'subject'" in e for e in errors)
        assert any("'content'" in e for e in errors)

    def test_invalid_to_type(self):
        """Invalid 'to' type should be reported."""
        data = {"to": "alice", "from": "bob", "subject": "Test", "content": "Content"}
        errors = validate_email_data(data)
        assert any("'to' must be a list" in e for e in errors)

    def test_empty_to_list(self):
        """Empty 'to' list should be reported."""
        data = {"to": [], "from": "bob", "subject": "Test", "content": "Content"}
        errors = validate_email_data(data)
        assert any("at least one recipient" in e for e in errors)

    def test_invalid_from_type(self):
        """Invalid 'from' type should be reported."""
        data = {"to": ["alice"], "from": 123, "subject": "Test", "content": "Content"}
        errors = validate_email_data(data)
        assert any("'from' must be a string" in e for e in errors)

    def test_empty_from(self):
        """Empty 'from' should be reported."""
        data = {"to": ["alice"], "from": "   ", "subject": "Test", "content": "Content"}
        errors = validate_email_data(data)
        assert any("'from' cannot be empty" in e for e in errors)

    def test_invalid_is_response_to(self):
        """Invalid 'isResponseTo' UUID should be reported."""
        data = {
            "to": ["alice"],
            "from": "bob",
            "subject": "Test",
            "content": "Content",
            "isResponseTo": "not-a-uuid"
        }
        errors = validate_email_data(data)
        assert any("valid UUID" in e for e in errors)


class TestCheckUnknownFields:
    """Tests for check_unknown_fields function."""

    def test_no_unknown_fields(self, sample_email_data):
        """Valid fields should return empty list."""
        unknown = check_unknown_fields(sample_email_data)
        assert unknown == []

    def test_unknown_fields_detected(self):
        """Unknown fields should be detected."""
        data = {
            "to": ["alice"],
            "from": "bob",
            "subject": "Test",
            "content": "Content",
            "unknownField": "value",
            "anotherUnknown": 123
        }
        unknown = check_unknown_fields(data)
        assert "unknownField" in unknown
        assert "anotherUnknown" in unknown
        assert len(unknown) == 2

    def test_allowed_fields_constant(self):
        """ALLOWED_EMAIL_FIELDS should contain expected fields."""
        expected = {"to", "from", "subject", "content", "isResponseTo"}
        assert ALLOWED_EMAIL_FIELDS == expected
