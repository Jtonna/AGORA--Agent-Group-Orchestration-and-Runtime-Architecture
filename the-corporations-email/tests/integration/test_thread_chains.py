"""
Integration tests for email thread chains.

Tests complex thread/reply chain scenarios including:
- Basic threading
- Complex trees with branches
- Edge cases (orphans, cycles)
- Deleted emails in threads
- Thread sorting
- Reply subject handling
"""

import pytest
import json

from models import Email
from storage import EmailStorage


class TestBasicThreading:
    """Tests for basic thread functionality."""

    def test_single_email_has_empty_thread(self, app_client):
        """Single email with no replies has empty thread."""
        # Create a single email
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Standalone Email",
                "content": "No replies expected"
            }),
            content_type='application/json; charset=utf-8'
        )
        email_id = response.get_json()['id']

        # View it
        response = app_client.get(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 200
        data = response.get_json()
        assert data['thread'] == []
        assert data['thread_pagination']['total_in_thread'] == 0

    def test_reply_shows_parent_in_thread(self, app_client):
        """Reply email shows parent in thread."""
        # Create parent
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Parent Email",
                "content": "Original message"
            }),
            content_type='application/json; charset=utf-8'
        )
        parent_id = response.get_json()['id']

        # Create reply
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Re: Parent Email",
                "content": "Reply message",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        reply_id = response.get_json()['id']

        # View reply - should show parent in thread
        response = app_client.get(f'/mail/{reply_id}?viewer=alice')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert parent_id in thread_ids
        assert reply_id not in thread_ids  # Current email excluded

    def test_parent_shows_child_in_thread(self, app_client):
        """Parent email shows child reply in thread."""
        # Create parent
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Parent Email",
                "content": "Original message"
            }),
            content_type='application/json; charset=utf-8'
        )
        parent_id = response.get_json()['id']

        # Create reply
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Re: Parent Email",
                "content": "Reply message",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        reply_id = response.get_json()['id']

        # View parent - should show reply in thread
        response = app_client.get(f'/mail/{parent_id}?viewer=bob')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert reply_id in thread_ids
        assert parent_id not in thread_ids  # Current email excluded

    def test_three_level_chain(self, app_client):
        """Three level reply chain builds correctly."""
        # Level 1: Original
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Original",
                "content": "Level 1"
            }),
            content_type='application/json; charset=utf-8'
        )
        level1_id = response.get_json()['id']

        # Level 2: Reply to original
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Re: Original",
                "content": "Level 2",
                "isResponseTo": level1_id
            }),
            content_type='application/json; charset=utf-8'
        )
        level2_id = response.get_json()['id']

        # Level 3: Reply to reply
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Re: Re: Original",
                "content": "Level 3",
                "isResponseTo": level2_id
            }),
            content_type='application/json; charset=utf-8'
        )
        level3_id = response.get_json()['id']

        # View level 3 - should see levels 1 and 2 in thread
        response = app_client.get(f'/mail/{level3_id}?viewer=bob')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert level1_id in thread_ids
        assert level2_id in thread_ids
        assert level3_id not in thread_ids
        assert len(thread_ids) == 2


class TestComplexTrees:
    """Tests for complex thread tree structures."""

    @pytest.fixture
    def branching_thread(self, fresh_storage):
        """Create a branching thread: root with 3 children."""
        # Root
        root = Email(
            id="00000000-0000-0000-0000-000000000001",
            to=["alice", "bob", "charlie"],
            from_="david",
            subject="Root",
            content="Root message",
            timestamp="2024-01-01T10:00:00Z"
        )
        fresh_storage.create(root)

        # Branch A (reply 1 to root)
        branch_a = Email(
            id="00000000-0000-0000-0000-000000000002",
            to=["david"],
            from_="alice",
            subject="Re: Root (Alice)",
            content="Alice's reply",
            timestamp="2024-01-02T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-000000000001"
        )
        fresh_storage.create(branch_a)

        # Branch B (reply 2 to root)
        branch_b = Email(
            id="00000000-0000-0000-0000-000000000003",
            to=["david"],
            from_="bob",
            subject="Re: Root (Bob)",
            content="Bob's reply",
            timestamp="2024-01-03T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-000000000001"
        )
        fresh_storage.create(branch_b)

        # Branch C (reply 3 to root)
        branch_c = Email(
            id="00000000-0000-0000-0000-000000000004",
            to=["david"],
            from_="charlie",
            subject="Re: Root (Charlie)",
            content="Charlie's reply",
            timestamp="2024-01-04T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-000000000001"
        )
        fresh_storage.create(branch_c)

        return fresh_storage

    @pytest.fixture
    def branching_client(self, branching_thread):
        """Flask client with branching thread."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_multiple_replies_to_same_parent(self, branching_client):
        """Multiple replies to same parent all appear in thread."""
        # View root - should see all 3 branches
        response = branching_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=david')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert "00000000-0000-0000-0000-000000000002" in thread_ids  # Alice
        assert "00000000-0000-0000-0000-000000000003" in thread_ids  # Bob
        assert "00000000-0000-0000-0000-000000000004" in thread_ids  # Charlie
        assert len(thread_ids) == 3

    def test_branching_from_any_email(self, branching_client):
        """Viewing any email in branch shows entire thread."""
        # View Alice's branch - should see root and other branches
        response = branching_client.get('/mail/00000000-0000-0000-0000-000000000002?viewer=alice')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert "00000000-0000-0000-0000-000000000001" in thread_ids  # Root
        assert "00000000-0000-0000-0000-000000000003" in thread_ids  # Bob
        assert "00000000-0000-0000-0000-000000000004" in thread_ids  # Charlie
        assert "00000000-0000-0000-0000-000000000002" not in thread_ids  # Self excluded
        assert len(thread_ids) == 3

    @pytest.fixture
    def deep_chain_storage(self, fresh_storage):
        """Create a 6-level deep chain."""
        prev_id = None
        for i in range(6):
            email = Email(
                id=f"00000000-0000-0000-0000-{str(i+1).zfill(12)}",
                to=["alice"] if i % 2 == 0 else ["bob"],
                from_="bob" if i % 2 == 0 else "alice",
                subject=f"Level {i+1}",
                content=f"Content {i+1}",
                timestamp=f"2024-01-{str(i+1).zfill(2)}T10:00:00Z",
                is_response_to=prev_id
            )
            fresh_storage.create(email)
            prev_id = email.id
        return fresh_storage

    @pytest.fixture
    def deep_chain_client(self, deep_chain_storage):
        """Flask client with 6-level chain."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_deep_chain_5_plus_levels(self, deep_chain_client):
        """Deep chain (6 levels) builds correctly."""
        # View the deepest email (level 6)
        response = deep_chain_client.get('/mail/00000000-0000-0000-0000-000000000006?viewer=alice')
        data = response.get_json()
        # Should see all 5 previous levels
        assert data['thread_pagination']['total_in_thread'] == 5


class TestEdgeCases:
    """Tests for edge cases in thread building."""

    def test_orphan_reference_parent_not_found(self, fresh_storage):
        """Email with non-existent parent ID handles gracefully."""
        # Create email with orphaned reference
        orphan = Email(
            id="00000000-0000-0000-0000-000000000001",
            to=["alice"],
            from_="bob",
            subject="Orphan Email",
            content="Parent doesn't exist",
            timestamp="2024-01-01T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-999999999999"  # Non-existent
        )
        fresh_storage.create(orphan)

        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            # Should still be viewable, just with empty thread
            response = client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=alice')
            assert response.status_code == 200
            data = response.get_json()
            # The orphan itself is the root now, so thread is empty
            assert data['thread'] == []

    def test_self_reply_own_email(self, app_client):
        """Replying to own email works."""
        # Create original from alice
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Self-discussion",
                "content": "Starting a thread"
            }),
            content_type='application/json; charset=utf-8'
        )
        original_id = response.get_json()['id']

        # Alice replies to herself
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Re: Self-discussion",
                "content": "Replying to myself",
                "isResponseTo": original_id
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        reply_id = response.get_json()['id']

        # View original - should show reply
        response = app_client.get(f'/mail/{original_id}?viewer=alice')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert reply_id in thread_ids


class TestDeletedEmailsInThreads:
    """Tests for deleted emails appearing in threads."""

    @pytest.fixture
    def thread_with_deleted(self, fresh_storage):
        """Create a thread where middle email is deleted."""
        # Root
        root = Email(
            id="00000000-0000-0000-0000-000000000001",
            to=["alice"],
            from_="bob",
            subject="Thread Root",
            content="Root content",
            timestamp="2024-01-01T10:00:00Z"
        )
        fresh_storage.create(root)

        # Middle email - deleted by alice
        middle = Email(
            id="00000000-0000-0000-0000-000000000002",
            to=["bob"],
            from_="alice",
            subject="Re: Thread Root",
            content="Middle content",
            timestamp="2024-01-02T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-000000000001",
            deleted_by=["alice"]
        )
        fresh_storage.create(middle)

        # Last email - reply to middle
        last = Email(
            id="00000000-0000-0000-0000-000000000003",
            to=["alice"],
            from_="bob",
            subject="Re: Re: Thread Root",
            content="Last content",
            timestamp="2024-01-03T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-000000000002"
        )
        fresh_storage.create(last)

        return fresh_storage

    @pytest.fixture
    def deleted_thread_client(self, thread_with_deleted):
        """Flask client with thread containing deleted email."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_deleted_email_appears_in_thread_summaries(self, deleted_thread_client):
        """Deleted email still appears in thread summaries."""
        # View the last email - should see middle (deleted) in thread
        response = deleted_thread_client.get('/mail/00000000-0000-0000-0000-000000000003?viewer=bob')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert "00000000-0000-0000-0000-000000000002" in thread_ids

    def test_can_reply_to_deleted_email(self, deleted_thread_client):
        """Can reply to a deleted email."""
        # Reply to the middle (deleted) email
        response = deleted_thread_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "charlie",
                "subject": "Reply to deleted",
                "content": "This should work",
                "isResponseTo": "00000000-0000-0000-0000-000000000002"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201

    def test_thread_visible_after_middle_deleted(self, deleted_thread_client):
        """Thread structure remains intact after middle email deleted."""
        # View root - should still see all emails in thread
        response = deleted_thread_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=bob')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        # Should see middle (deleted) and last
        assert "00000000-0000-0000-0000-000000000002" in thread_ids
        assert "00000000-0000-0000-0000-000000000003" in thread_ids

    @pytest.fixture
    def thread_with_deleted_root(self, fresh_storage):
        """Create a thread where root is deleted."""
        root = Email(
            id="00000000-0000-0000-0000-000000000001",
            to=["alice"],
            from_="bob",
            subject="Deleted Root",
            content="Root was deleted",
            timestamp="2024-01-01T10:00:00Z",
            deleted_by=["bob"]
        )
        fresh_storage.create(root)

        reply = Email(
            id="00000000-0000-0000-0000-000000000002",
            to=["bob"],
            from_="alice",
            subject="Re: Deleted Root",
            content="Reply to deleted root",
            timestamp="2024-01-02T10:00:00Z",
            is_response_to="00000000-0000-0000-0000-000000000001"
        )
        fresh_storage.create(reply)

        return fresh_storage

    @pytest.fixture
    def deleted_root_client(self, thread_with_deleted_root):
        """Flask client with deleted root thread."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_thread_visible_after_root_deleted(self, deleted_root_client):
        """Thread still visible when root is deleted."""
        # View the reply - should still see root in thread
        response = deleted_root_client.get('/mail/00000000-0000-0000-0000-000000000002?viewer=alice')
        data = response.get_json()
        thread_ids = [e['id'] for e in data['thread']]
        assert "00000000-0000-0000-0000-000000000001" in thread_ids


class TestThreadSorting:
    """Tests for thread sorting behavior."""

    @pytest.fixture
    def unsorted_thread(self, fresh_storage):
        """Create a thread with out-of-order timestamps."""
        root = Email(
            id="00000000-0000-0000-0000-000000000001",
            to=["alice"],
            from_="bob",
            subject="Root",
            content="Root",
            timestamp="2024-01-05T10:00:00Z"  # Middle timestamp
        )
        fresh_storage.create(root)

        reply1 = Email(
            id="00000000-0000-0000-0000-000000000002",
            to=["bob"],
            from_="alice",
            subject="Re: Root",
            content="Earlier reply",
            timestamp="2024-01-01T10:00:00Z",  # Earliest
            is_response_to="00000000-0000-0000-0000-000000000001"
        )
        fresh_storage.create(reply1)

        reply2 = Email(
            id="00000000-0000-0000-0000-000000000003",
            to=["bob"],
            from_="alice",
            subject="Re: Root",
            content="Latest reply",
            timestamp="2024-01-10T10:00:00Z",  # Latest
            is_response_to="00000000-0000-0000-0000-000000000001"
        )
        fresh_storage.create(reply2)

        return fresh_storage

    @pytest.fixture
    def unsorted_client(self, unsorted_thread):
        """Flask client with unsorted thread."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_thread_sorted_newest_first(self, unsorted_client):
        """Thread is sorted by timestamp descending (newest first)."""
        response = unsorted_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=bob')
        data = response.get_json()
        timestamps = [e['timestamp'] for e in data['thread']]
        assert timestamps == sorted(timestamps, reverse=True)
        # Latest reply (2024-01-10) should be first
        assert data['thread'][0]['id'] == "00000000-0000-0000-0000-000000000003"


class TestReplySubjectHandling:
    """Tests for reply subject prefix handling."""

    def test_re_prepended_for_reply(self, app_client):
        """'Re: ' is prepended for reply without it."""
        # Create parent
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Original Subject",
                "content": "Content"
            }),
            content_type='application/json; charset=utf-8'
        )
        parent_id = response.get_json()['id']

        # Create reply without Re:
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Original Subject",  # No Re:
                "content": "Reply",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        reply_id = response.get_json()['id']

        # Check subject was prefixed
        response = app_client.get(f'/mail/{reply_id}?viewer=alice')
        assert response.get_json()['email']['subject'] == "Re: Original Subject"

    def test_re_not_duplicated(self, app_client):
        """'Re: ' is not duplicated if already present."""
        # Create parent
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Original",
                "content": "Content"
            }),
            content_type='application/json; charset=utf-8'
        )
        parent_id = response.get_json()['id']

        # Create reply with Re: already
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["bob"],
                "from": "alice",
                "subject": "Re: Original",  # Already has Re:
                "content": "Reply",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        reply_id = response.get_json()['id']

        # Check subject is not Re: Re:
        response = app_client.get(f'/mail/{reply_id}?viewer=alice')
        assert response.get_json()['email']['subject'] == "Re: Original"

    def test_case_insensitive_re_check(self, app_client):
        """'re:' check is case insensitive."""
        # Create parent
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Original",
                "content": "Content"
            }),
            content_type='application/json; charset=utf-8'
        )
        parent_id = response.get_json()['id']

        # Test various cases of "Re:"
        test_subjects = ["RE: Original", "re: Original", "Re: Original", "rE: Original"]

        for subject in test_subjects:
            response = app_client.post(
                '/mail',
                data=json.dumps({
                    "to": ["bob"],
                    "from": "alice",
                    "subject": subject,
                    "content": "Reply",
                    "isResponseTo": parent_id
                }),
                content_type='application/json; charset=utf-8'
            )
            reply_id = response.get_json()['id']
            response = app_client.get(f'/mail/{reply_id}?viewer=alice')
            # Should preserve original casing, not add another Re:
            assert response.get_json()['email']['subject'] == subject

    def test_no_re_for_non_reply(self, app_client):
        """'Re: ' is not prepended for non-reply emails."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "New Email",  # No isResponseTo
                "content": "Content"
            }),
            content_type='application/json; charset=utf-8'
        )
        email_id = response.get_json()['id']

        # Check subject unchanged
        response = app_client.get(f'/mail/{email_id}?viewer=alice')
        assert response.get_json()['email']['subject'] == "New Email"
