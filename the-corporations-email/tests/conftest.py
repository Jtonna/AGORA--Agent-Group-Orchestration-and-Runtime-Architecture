"""
Shared pytest fixtures for the-corporations-email tests.
"""

import pytest
import sys
import os
import tempfile
import shutil

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from storage import EmailStorage, get_storage
from models import Email, generate_uuid, generate_timestamp


@pytest.fixture
def sample_email_data():
    """Fixture providing sample email data for tests."""
    return {
        "to": ["alice", "bob"],
        "from": "charlie",
        "subject": "Test Subject",
        "content": "Test content body"
    }


@pytest.fixture
def sample_reply_data():
    """Fixture providing sample reply email data for tests."""
    return {
        "to": ["charlie"],
        "from": "alice",
        "subject": "Re: Test Subject",
        "content": "Reply content",
        "isResponseTo": "00000000-0000-0000-0000-000000000001"
    }


@pytest.fixture
def temp_data_dir():
    """Create a temporary data directory for tests."""
    temp_dir = tempfile.mkdtemp()
    yield temp_dir
    # Cleanup after test
    shutil.rmtree(temp_dir, ignore_errors=True)


@pytest.fixture
def fresh_storage(temp_data_dir):
    """
    Fixture providing a fresh storage instance with empty data.
    Resets the singleton and initializes with temp directory.
    """
    # Reset the singleton
    EmailStorage.reset_instance()

    # Create new instance with temp directory
    storage = EmailStorage(temp_data_dir)
    storage.initialize()

    yield storage

    # Cleanup: reset singleton after test
    EmailStorage.reset_instance()


@pytest.fixture
def app_client(fresh_storage):
    """
    Fixture providing a Flask test client with fresh storage.
    """
    from app import app

    app.config['TESTING'] = True

    with app.test_client() as client:
        yield client


@pytest.fixture
def populated_storage(fresh_storage):
    """
    Fixture providing storage pre-populated with test emails.
    Creates a set of emails for testing various scenarios.
    Also registers agents in the directory for "everyone" expansion tests.
    """
    # Register agents in directory (for "everyone" expansion)
    for agent in ["alice", "bob", "charlie", "david", "eve"]:
        fresh_storage.register_agent(agent)

    # Create test emails
    emails = []

    # Email 1: alice -> bob, charlie
    email1 = Email(
        id="00000000-0000-0000-0000-000000000001",
        to=["bob", "charlie"],
        from_="alice",
        subject="Hello from Alice",
        content="This is the first test email.",
        timestamp="2024-01-15T10:00:00Z"
    )
    fresh_storage.create(email1)
    emails.append(email1)

    # Email 2: bob -> alice (reply to email1)
    email2 = Email(
        id="00000000-0000-0000-0000-000000000002",
        to=["alice"],
        from_="bob",
        subject="Re: Hello from Alice",
        content="Reply from Bob.",
        timestamp="2024-01-15T11:00:00Z",
        is_response_to="00000000-0000-0000-0000-000000000001"
    )
    fresh_storage.create(email2)
    emails.append(email2)

    # Email 3: charlie -> alice, bob (new thread)
    email3 = Email(
        id="00000000-0000-0000-0000-000000000003",
        to=["alice", "bob"],
        from_="charlie",
        subject="Meeting Tomorrow",
        content="Let's have a meeting.",
        timestamp="2024-01-15T12:00:00Z"
    )
    fresh_storage.create(email3)
    emails.append(email3)

    # Email 4: alice -> charlie (reply to email3)
    email4 = Email(
        id="00000000-0000-0000-0000-000000000004",
        to=["charlie"],
        from_="alice",
        subject="Re: Meeting Tomorrow",
        content="Sounds good!",
        timestamp="2024-01-15T13:00:00Z",
        is_response_to="00000000-0000-0000-0000-000000000003"
    )
    fresh_storage.create(email4)
    emails.append(email4)

    # Email 5: deleted by alice
    email5 = Email(
        id="00000000-0000-0000-0000-000000000005",
        to=["alice"],
        from_="david",
        subject="Deleted Email",
        content="This email is deleted by alice.",
        timestamp="2024-01-15T14:00:00Z",
        deleted_by=["alice"]
    )
    fresh_storage.create(email5)
    emails.append(email5)

    # Email 6: read by bob
    email6 = Email(
        id="00000000-0000-0000-0000-000000000006",
        to=["bob"],
        from_="eve",
        subject="Read Email",
        content="This email is read by bob.",
        timestamp="2024-01-15T15:00:00Z",
        read_by=["bob"]
    )
    fresh_storage.create(email6)
    emails.append(email6)

    return fresh_storage, emails


@pytest.fixture
def populated_client(populated_storage):
    """
    Fixture providing a Flask test client with pre-populated storage.
    """
    from app import app

    app.config['TESTING'] = True

    storage, emails = populated_storage

    with app.test_client() as client:
        yield client, emails
