"""
Shared pytest fixtures for the-corporations-email tests.
"""

import pytest
import sys
import os

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


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
