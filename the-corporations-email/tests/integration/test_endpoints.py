"""
Integration tests for API endpoints.

Tests all endpoints for correct behavior, error handling, and response formats.
"""

import pytest
import json


class TestHealthEndpoint:
    """Tests for GET /health endpoint."""

    def test_health_returns_200_ok(self, app_client):
        """Health check returns 200 with status ok."""
        response = app_client.get('/health')
        assert response.status_code == 200
        data = response.get_json()
        assert data == {"status": "ok"}

    def test_health_content_type(self, app_client):
        """Health check returns JSON content type."""
        response = app_client.get('/health')
        assert 'application/json' in response.content_type

    def test_health_rejects_query_params(self, app_client):
        """Health check rejects any query parameters."""
        response = app_client.get('/health?foo=bar')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'UNKNOWN_PARAMETER'
        assert 'foo' in data['error']

    def test_health_rejects_duplicate_params(self, app_client):
        """Health check rejects duplicate query parameters."""
        response = app_client.get('/health?viewer=alice&viewer=bob')
        assert response.status_code == 400
        data = response.get_json()
        # Should catch unknown first, but either is acceptable
        assert data['code'] in ['UNKNOWN_PARAMETER', 'DUPLICATE_PARAMETER']


class TestGetInbox:
    """Tests for GET /mail endpoint."""

    def test_inbox_returns_emails_for_viewer(self, populated_client):
        """Inbox returns emails where viewer is participant."""
        client, emails = populated_client
        response = client.get('/mail?viewer=alice')
        assert response.status_code == 200
        data = response.get_json()
        assert 'data' in data
        assert 'pagination' in data
        # Alice should see emails where she's in 'to' or 'from'
        # She's in: 1 (from), 2 (to), 3 (to), 4 (from), 5 (to but deleted)
        # Email 5 is deleted by alice, so shouldn't appear
        assert len(data['data']) == 4

    def test_inbox_excludes_deleted_emails(self, populated_client):
        """Inbox excludes emails deleted by viewer."""
        client, emails = populated_client
        response = client.get('/mail?viewer=alice')
        data = response.get_json()
        # Email 5 is deleted by alice
        email_ids = [e['id'] for e in data['data']]
        assert "00000000-0000-0000-0000-000000000005" not in email_ids

    def test_inbox_shows_deleted_for_others(self, populated_client):
        """Inbox shows emails deleted by someone else."""
        client, emails = populated_client
        response = client.get('/mail?viewer=david')
        data = response.get_json()
        # David sent email 5, which alice deleted, but david should see it
        email_ids = [e['id'] for e in data['data']]
        assert "00000000-0000-0000-0000-000000000005" in email_ids

    def test_inbox_returns_read_status(self, populated_client):
        """Inbox returns read status per viewer."""
        client, emails = populated_client
        response = client.get('/mail?viewer=bob')
        data = response.get_json()
        # Email 6 is read by bob
        for email in data['data']:
            if email['id'] == "00000000-0000-0000-0000-000000000006":
                assert email['read'] is True
            else:
                assert email['read'] is False

    def test_inbox_sorted_newest_first(self, populated_client):
        """Inbox is sorted by timestamp descending."""
        client, emails = populated_client
        response = client.get('/mail?viewer=bob')
        data = response.get_json()
        timestamps = [e['timestamp'] for e in data['data']]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_inbox_missing_viewer_returns_400(self, app_client):
        """Missing viewer parameter returns 400."""
        response = app_client.get('/mail')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'MISSING_VIEWER'

    def test_inbox_empty_viewer_returns_400(self, app_client):
        """Empty viewer parameter returns 400."""
        response = app_client.get('/mail?viewer=')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_VIEWER'

    def test_inbox_whitespace_viewer_returns_400(self, app_client):
        """Whitespace-only viewer parameter returns 400."""
        response = app_client.get('/mail?viewer=%20%20')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_VIEWER'

    def test_inbox_unknown_param_returns_400(self, app_client):
        """Unknown query parameter returns 400."""
        response = app_client.get('/mail?viewer=alice&unknown=value')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'UNKNOWN_PARAMETER'

    def test_inbox_duplicate_viewer_returns_400(self, app_client):
        """Duplicate viewer parameter returns 400."""
        response = app_client.get('/mail?viewer=alice&viewer=bob')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'DUPLICATE_PARAMETER'

    def test_inbox_does_not_include_content(self, populated_client):
        """Inbox emails don't include content field."""
        client, emails = populated_client
        response = client.get('/mail?viewer=alice')
        data = response.get_json()
        for email in data['data']:
            assert 'content' not in email

    def test_inbox_does_not_include_readBy_deletedBy(self, populated_client):
        """Inbox emails don't include readBy or deletedBy."""
        client, emails = populated_client
        response = client.get('/mail?viewer=alice')
        data = response.get_json()
        for email in data['data']:
            assert 'readBy' not in email
            assert 'deletedBy' not in email


class TestGetEmailDetail:
    """Tests for GET /mail/{id} endpoint."""

    def test_detail_returns_full_email(self, populated_client):
        """Email detail returns full email with content."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"
        response = client.get(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 200
        data = response.get_json()
        assert 'email' in data
        assert data['email']['id'] == email_id
        assert 'content' in data['email']
        assert data['email']['content'] == "This is the first test email."

    def test_detail_returns_thread_summaries(self, populated_client):
        """Email detail returns thread summaries without content."""
        client, emails = populated_client
        # Get email 2 which is a reply to email 1
        email_id = "00000000-0000-0000-0000-000000000002"
        response = client.get(f'/mail/{email_id}?viewer=bob')
        data = response.get_json()
        assert 'thread' in data
        # Thread should include email 1 (parent)
        thread_ids = [e['id'] for e in data['thread']]
        assert "00000000-0000-0000-0000-000000000001" in thread_ids
        # Thread summaries shouldn't have content
        for thread_email in data['thread']:
            assert 'content' not in thread_email

    def test_detail_marks_as_read(self, populated_client):
        """Viewing email marks it as read."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"
        # First check it's not read
        response = client.get('/mail?viewer=bob')
        data = response.get_json()
        for email in data['data']:
            if email['id'] == email_id:
                assert email['read'] is False

        # View the email
        response = client.get(f'/mail/{email_id}?viewer=bob')
        assert response.status_code == 200

        # Now it should be read
        response = client.get('/mail?viewer=bob')
        data = response.get_json()
        for email in data['data']:
            if email['id'] == email_id:
                assert email['read'] is True

    def test_detail_missing_viewer_returns_400(self, populated_client):
        """Missing viewer parameter returns 400."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"
        response = client.get(f'/mail/{email_id}')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'MISSING_VIEWER'

    def test_detail_invalid_uuid_returns_400(self, populated_client):
        """Invalid UUID returns 400."""
        client, emails = populated_client
        response = client.get('/mail/not-a-uuid?viewer=alice')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_UUID'

    def test_detail_not_found_returns_404(self, populated_client):
        """Non-existent email returns 404."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000099"
        response = client.get(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 404
        data = response.get_json()
        assert data['code'] == 'EMAIL_NOT_FOUND'

    def test_detail_deleted_returns_410(self, populated_client):
        """Deleted email returns 410."""
        client, emails = populated_client
        # Email 5 is deleted by alice
        email_id = "00000000-0000-0000-0000-000000000005"
        response = client.get(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 410
        data = response.get_json()
        assert data['code'] == 'EMAIL_DELETED'

    def test_detail_shows_deleted_to_others(self, populated_client):
        """Non-deleter can still view deleted email."""
        client, emails = populated_client
        # Email 5 is deleted by alice but david sent it
        email_id = "00000000-0000-0000-0000-000000000005"
        response = client.get(f'/mail/{email_id}?viewer=david')
        assert response.status_code == 200

    def test_detail_includes_thread_pagination(self, populated_client):
        """Email detail includes thread pagination info."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"
        response = client.get(f'/mail/{email_id}?viewer=alice')
        data = response.get_json()
        assert 'thread_pagination' in data
        pagination = data['thread_pagination']
        assert 'page' in pagination
        assert 'per_page' in pagination
        assert 'total_in_thread' in pagination
        assert 'total_pages' in pagination
        assert 'has_next' in pagination
        assert 'has_prev' in pagination


class TestSendEmail:
    """Tests for POST /mail endpoint."""

    def test_send_creates_email(self, app_client):
        """POST /mail creates email successfully."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test Subject",
                "content": "Test content"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        data = response.get_json()
        assert 'id' in data
        assert data['message'] == 'Email sent successfully'

    def test_send_returns_valid_uuid(self, app_client):
        """Created email has valid UUID."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test",
                "content": "Test"
            }),
            content_type='application/json; charset=utf-8'
        )
        data = response.get_json()
        # UUID format check
        from models import validate_uuid
        assert validate_uuid(data['id'])

    def test_send_reply_prepends_re(self, populated_client):
        """Reply without Re: gets it prepended."""
        client, emails = populated_client
        parent_id = "00000000-0000-0000-0000-000000000001"
        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Hello from Alice",  # No "Re: "
                "content": "Reply",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        # Verify the email was created with Re:
        email_id = response.get_json()['id']
        detail = client.get(f'/mail/{email_id}?viewer=bob')
        assert detail.get_json()['email']['subject'] == "Re: Hello from Alice"

    def test_send_reply_no_duplicate_re(self, populated_client):
        """Reply with existing Re: doesn't duplicate."""
        client, emails = populated_client
        parent_id = "00000000-0000-0000-0000-000000000001"
        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Re: Hello",
                "content": "Reply",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']
        detail = client.get(f'/mail/{email_id}?viewer=bob')
        assert detail.get_json()['email']['subject'] == "Re: Hello"

    def test_send_reply_case_insensitive_re(self, populated_client):
        """Re: check is case insensitive."""
        client, emails = populated_client
        parent_id = "00000000-0000-0000-0000-000000000001"
        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "RE: Hello",
                "content": "Reply",
                "isResponseTo": parent_id
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']
        detail = client.get(f'/mail/{email_id}?viewer=bob')
        # Should keep original "RE:" without adding another
        assert detail.get_json()['email']['subject'] == "RE: Hello"

    def test_send_missing_content_type_returns_415(self, app_client):
        """Missing Content-Type returns 415."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test",
                "content": "Test"
            })
            # No content_type specified
        )
        assert response.status_code == 415
        data = response.get_json()
        assert data['code'] == 'UNSUPPORTED_MEDIA_TYPE'

    def test_send_wrong_content_type_returns_415(self, app_client):
        """Wrong Content-Type returns 415."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test",
                "content": "Test"
            }),
            content_type='text/plain'
        )
        assert response.status_code == 415
        data = response.get_json()
        assert data['code'] == 'UNSUPPORTED_MEDIA_TYPE'

    def test_send_invalid_json_returns_400(self, app_client):
        """Invalid JSON returns 400."""
        response = app_client.post(
            '/mail',
            data='not valid json',
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_JSON'

    def test_send_missing_fields_returns_400(self, app_client):
        """Missing required fields returns 400."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"]
                # Missing from, subject, content
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'MISSING_FIELD'

    def test_send_unknown_field_returns_400(self, app_client):
        """Unknown field returns 400."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test",
                "content": "Test",
                "unknownField": "value"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'UNKNOWN_FIELD'

    def test_send_invalid_to_type_returns_400(self, app_client):
        """Invalid 'to' type returns 400."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": "alice",  # Should be array
                "from": "bob",
                "subject": "Test",
                "content": "Test"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_FIELD'
        assert 'to' in data['error']

    def test_send_empty_to_returns_400(self, app_client):
        """Empty 'to' array returns 400."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": [],
                "from": "bob",
                "subject": "Test",
                "content": "Test"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_FIELD'

    def test_send_invalid_parent_returns_400(self, app_client):
        """Invalid parent UUID returns 400."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test",
                "content": "Test",
                "isResponseTo": "not-a-uuid"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_UUID'

    def test_send_parent_not_found_returns_404(self, app_client):
        """Non-existent parent returns 404."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Test",
                "content": "Test",
                "isResponseTo": "00000000-0000-0000-0000-000000000099"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 404
        data = response.get_json()
        assert data['code'] == 'PARENT_NOT_FOUND'


class TestEveryoneRecipient:
    """Tests for 'everyone' recipient expansion."""

    def test_everyone_expands_to_known_agents(self, populated_client):
        """Sending to 'everyone' expands to all known agents."""
        client, emails = populated_client
        # Existing emails involve: alice, bob, charlie, david, eve

        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["everyone"],
                "from": "admin",
                "subject": "ANNOUNCEMENT: Test broadcast",
                "content": "Broadcast message"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']

        # Verify the recipients were expanded
        detail = client.get(f'/mail/{email_id}?viewer=admin')
        data = detail.get_json()
        to_list = data['email']['to']

        # Should include all known agents from populated_client
        assert 'alice' in to_list
        assert 'bob' in to_list
        assert 'charlie' in to_list
        assert 'david' in to_list
        assert 'eve' in to_list

    def test_everyone_excludes_sender(self, populated_client):
        """Sender is excluded from 'everyone' expansion."""
        client, emails = populated_client

        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["everyone"],
                "from": "alice",  # alice is a known agent
                "subject": "ANNOUNCEMENT: From Alice",
                "content": "Broadcast"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']

        detail = client.get(f'/mail/{email_id}?viewer=bob')
        to_list = detail.get_json()['email']['to']

        # alice should NOT be in the recipients (she's the sender)
        assert 'alice' not in to_list
        # But other agents should be
        assert 'bob' in to_list

    def test_everyone_mixed_with_explicit_recipients(self, populated_client):
        """'everyone' can be mixed with explicit recipients."""
        client, emails = populated_client

        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["everyone", "specific-user"],
                "from": "admin",
                "subject": "ANNOUNCEMENT: Mixed",
                "content": "Message"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']

        detail = client.get(f'/mail/{email_id}?viewer=admin')
        to_list = detail.get_json()['email']['to']

        # Should include the explicit recipient
        assert 'specific-user' in to_list
        # And also the known agents
        assert 'alice' in to_list

    def test_everyone_deduplicates_recipients(self, populated_client):
        """Duplicate recipients are removed after expansion."""
        client, emails = populated_client

        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["everyone", "alice"],  # alice is also in "everyone"
                "from": "admin",
                "subject": "ANNOUNCEMENT: With duplicate",
                "content": "Message"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']

        detail = client.get(f'/mail/{email_id}?viewer=admin')
        to_list = detail.get_json()['email']['to']

        # alice should appear only once
        assert to_list.count('alice') == 1

    def test_everyone_case_insensitive(self, populated_client):
        """'EVERYONE' and 'Everyone' also expand."""
        client, emails = populated_client

        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["EVERYONE"],
                "from": "admin",
                "subject": "ANNOUNCEMENT: Uppercase",
                "content": "Message"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']

        detail = client.get(f'/mail/{email_id}?viewer=admin')
        to_list = detail.get_json()['email']['to']

        # Should have expanded to known agents
        assert 'alice' in to_list
        # 'everyone' itself should not be in the list
        assert 'everyone' not in to_list
        assert 'EVERYONE' not in to_list

    def test_everyone_on_empty_system_returns_error(self, app_client):
        """Sending to 'everyone' on empty system returns error."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["everyone"],
                "from": "admin",
                "subject": "ANNOUNCEMENT: First broadcast",
                "content": "Message"
            }),
            content_type='application/json; charset=utf-8'
        )
        # Should fail - no known agents to broadcast to
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_FIELD'
        assert 'No known agents' in data['error']

    def test_everyone_recipients_see_email_in_inbox(self, populated_client):
        """Recipients from 'everyone' expansion can see email in inbox."""
        client, emails = populated_client

        response = client.post(
            '/mail',
            data=json.dumps({
                "to": ["everyone"],
                "from": "admin",
                "subject": "ANNOUNCEMENT: Check inbox",
                "content": "All should see this"
            }),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        email_id = response.get_json()['id']

        # bob should see the email in their inbox
        inbox = client.get('/mail?viewer=bob')
        inbox_ids = [e['id'] for e in inbox.get_json()['data']]
        assert email_id in inbox_ids


class TestDirectoryEndpoints:
    """Tests for /directory/agents and /agents/spawn endpoints."""

    def test_get_agents_empty(self, app_client):
        """GET /directory/agents returns empty list when no agents registered."""
        response = app_client.get('/directory/agents')
        assert response.status_code == 200
        data = response.get_json()
        assert data == {"agents": []}

    def test_get_agents_returns_spawned(self, app_client):
        """GET /directory/agents returns all spawned agents."""
        # Spawn some agents
        app_client.post('/agents/spawn')
        app_client.post('/agents/spawn')

        response = app_client.get('/directory/agents')
        assert response.status_code == 200
        data = response.get_json()
        agents = data['agents']
        assert len(agents) == 2
        # Each agent should have name, pid, and supervisor
        for agent in agents:
            assert 'name' in agent
            assert 'pid' in agent
            assert 'supervisor' in agent
            assert isinstance(agent['name'], str)
            assert len(agent['name']) > 0

    def test_spawn_agent_success(self, app_client):
        """POST /agents/spawn creates agent with auto-generated name."""
        response = app_client.post('/agents/spawn')
        assert response.status_code == 201
        data = response.get_json()
        assert 'agent_name' in data
        assert isinstance(data['agent_name'], str)
        assert len(data['agent_name']) > 0
        assert data['agent_name'].islower()  # Names are lowercase

    def test_spawn_generates_unique_names(self, app_client):
        """Multiple spawns generate unique names."""
        names_seen = set()
        for _ in range(10):
            response = app_client.post('/agents/spawn')
            assert response.status_code == 201
            name = response.get_json()['agent_name']
            assert name not in names_seen, f"Duplicate name generated: {name}"
            names_seen.add(name)

    def test_spawn_agent_appears_in_directory(self, app_client):
        """Spawned agent appears in GET /directory/agents."""
        spawn_response = app_client.post('/agents/spawn')
        spawned_name = spawn_response.get_json()['agent_name']

        list_response = app_client.get('/directory/agents')
        agents = list_response.get_json()['agents']
        names = [a['name'] for a in agents]
        assert spawned_name in names

    def test_spawn_with_supervisor(self, app_client):
        """POST /agents/spawn with supervisor stores it."""
        response = app_client.post(
            '/agents/spawn',
            data=json.dumps({"supervisor": "mike"}),
            content_type='application/json; charset=utf-8'
        )
        assert response.status_code == 201
        spawned_name = response.get_json()['agent_name']

        # Check supervisor is stored
        list_response = app_client.get('/directory/agents')
        agents = list_response.get_json()['agents']
        agent = next(a for a in agents if a['name'] == spawned_name)
        assert agent['supervisor'] == 'mike'

    def test_spawn_without_supervisor(self, app_client):
        """POST /agents/spawn without supervisor has null supervisor."""
        response = app_client.post('/agents/spawn')
        spawned_name = response.get_json()['agent_name']

        list_response = app_client.get('/directory/agents')
        agents = list_response.get_json()['agents']
        agent = next(a for a in agents if a['name'] == spawned_name)
        assert agent['supervisor'] is None


class TestDeleteEmail:
    """Tests for DELETE /mail/{id} endpoint."""

    def test_delete_succeeds(self, populated_client):
        """DELETE /mail/{id} succeeds for participant."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"
        response = client.delete(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 200
        data = response.get_json()
        assert data['message'] == 'Email deleted'

    def test_delete_is_idempotent(self, populated_client):
        """Deleting twice returns 200 both times."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"

        # First delete
        response = client.delete(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 200

        # Second delete - should still be 200
        response = client.delete(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 200

    def test_delete_hides_from_inbox(self, populated_client):
        """Deleted email doesn't appear in inbox."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"

        # Delete the email
        client.delete(f'/mail/{email_id}?viewer=alice')

        # Check inbox
        response = client.get('/mail?viewer=alice')
        data = response.get_json()
        email_ids = [e['id'] for e in data['data']]
        assert email_id not in email_ids

    def test_delete_non_participant_returns_403(self, populated_client):
        """Non-participant cannot delete."""
        client, emails = populated_client
        # Email 1 is alice -> bob, charlie
        email_id = "00000000-0000-0000-0000-000000000001"
        response = client.delete(f'/mail/{email_id}?viewer=eve')
        assert response.status_code == 403
        data = response.get_json()
        assert data['code'] == 'NOT_PARTICIPANT'

    def test_delete_missing_viewer_returns_400(self, populated_client):
        """Missing viewer returns 400."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000001"
        response = client.delete(f'/mail/{email_id}')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'MISSING_VIEWER'

    def test_delete_invalid_uuid_returns_400(self, populated_client):
        """Invalid UUID returns 400."""
        client, emails = populated_client
        response = client.delete('/mail/not-a-uuid?viewer=alice')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_UUID'

    def test_delete_not_found_returns_404(self, populated_client):
        """Non-existent email returns 404."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000099"
        response = client.delete(f'/mail/{email_id}?viewer=alice')
        assert response.status_code == 404
        data = response.get_json()
        assert data['code'] == 'EMAIL_NOT_FOUND'


class TestInvestigation:
    """Tests for GET /investigation/{name} endpoint."""

    def test_investigation_returns_all_emails(self, populated_client):
        """Investigation returns all emails for person."""
        client, emails = populated_client
        response = client.get('/investigation/alice')
        assert response.status_code == 200
        data = response.get_json()
        assert 'data' in data
        assert 'pagination' in data
        # Alice is in emails 1,2,3,4,5 (including deleted)
        assert len(data['data']) == 5

    def test_investigation_includes_deleted(self, populated_client):
        """Investigation includes deleted emails."""
        client, emails = populated_client
        response = client.get('/investigation/alice')
        data = response.get_json()
        # Email 5 is deleted by alice but should appear
        email_ids = [e['id'] for e in data['data']]
        assert "00000000-0000-0000-0000-000000000005" in email_ids

    def test_investigation_includes_readby_deletedby(self, populated_client):
        """Investigation includes readBy and deletedBy."""
        client, emails = populated_client
        response = client.get('/investigation/alice')
        data = response.get_json()
        for email in data['data']:
            assert 'readBy' in email
            assert 'deletedBy' in email

    def test_investigation_case_insensitive(self, populated_client):
        """Investigation name matching is case insensitive."""
        client, emails = populated_client

        # Get with lowercase
        response1 = client.get('/investigation/alice')
        data1 = response1.get_json()

        # Get with uppercase
        response2 = client.get('/investigation/ALICE')
        data2 = response2.get_json()

        assert len(data1['data']) == len(data2['data'])

    def test_investigation_empty_name_returns_400(self, populated_client):
        """Empty name returns 400."""
        client, emails = populated_client
        response = client.get('/investigation/%20')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_NAME'

    def test_investigation_sorted_newest_first(self, populated_client):
        """Investigation results are sorted by timestamp descending."""
        client, emails = populated_client
        response = client.get('/investigation/alice')
        data = response.get_json()
        timestamps = [e['timestamp'] for e in data['data']]
        assert timestamps == sorted(timestamps, reverse=True)

    def test_investigation_unknown_param_returns_400(self, populated_client):
        """Unknown query parameter returns 400."""
        client, emails = populated_client
        response = client.get('/investigation/alice?unknown=value')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'UNKNOWN_PARAMETER'


class TestErrorCheckOrder:
    """Tests to verify errors are checked in the correct order."""

    def test_unknown_param_before_missing_viewer(self, app_client):
        """Unknown param error comes before missing viewer."""
        response = app_client.get('/mail?unknown=value')
        data = response.get_json()
        # Should be UNKNOWN_PARAMETER, not MISSING_VIEWER
        assert data['code'] == 'UNKNOWN_PARAMETER'

    def test_duplicate_param_before_missing_viewer(self, app_client):
        """Duplicate param error comes before missing viewer."""
        response = app_client.get('/mail?page=1&page=2')
        data = response.get_json()
        # Should be DUPLICATE_PARAMETER (or UNKNOWN_PARAMETER), not MISSING_VIEWER
        assert data['code'] in ['DUPLICATE_PARAMETER', 'UNKNOWN_PARAMETER']

    def test_content_type_before_json_validation(self, app_client):
        """Content-Type check comes before JSON validation."""
        response = app_client.post(
            '/mail',
            data='not json',
            content_type='text/plain'
        )
        data = response.get_json()
        # Should be UNSUPPORTED_MEDIA_TYPE, not INVALID_JSON
        assert data['code'] == 'UNSUPPORTED_MEDIA_TYPE'

    def test_unknown_field_before_missing_field(self, app_client):
        """Unknown field check comes before missing field."""
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "unknownField": "value"
                # Missing from, subject, content
            }),
            content_type='application/json; charset=utf-8'
        )
        data = response.get_json()
        # Should be UNKNOWN_FIELD, not MISSING_FIELD
        assert data['code'] == 'UNKNOWN_FIELD'

    def test_missing_viewer_before_invalid_uuid(self, populated_client):
        """Missing viewer check comes before UUID validation."""
        client, emails = populated_client
        response = client.get('/mail/not-a-uuid')
        data = response.get_json()
        # Should be MISSING_VIEWER, not INVALID_UUID
        assert data['code'] == 'MISSING_VIEWER'

    def test_invalid_viewer_before_invalid_uuid(self, populated_client):
        """Invalid viewer check comes before UUID validation."""
        client, emails = populated_client
        response = client.get('/mail/not-a-uuid?viewer=%20')
        data = response.get_json()
        # Should be INVALID_VIEWER, not INVALID_UUID
        assert data['code'] == 'INVALID_VIEWER'

    def test_invalid_uuid_before_not_found(self, populated_client):
        """Invalid UUID check comes before not found."""
        client, emails = populated_client
        response = client.get('/mail/not-a-uuid?viewer=alice')
        data = response.get_json()
        # Should be INVALID_UUID, not EMAIL_NOT_FOUND
        assert data['code'] == 'INVALID_UUID'

    def test_not_found_before_not_participant(self, populated_client):
        """Not found check comes before not participant."""
        client, emails = populated_client
        email_id = "00000000-0000-0000-0000-000000000099"
        response = client.delete(f'/mail/{email_id}?viewer=eve')
        data = response.get_json()
        # Should be EMAIL_NOT_FOUND, not NOT_PARTICIPANT
        assert data['code'] == 'EMAIL_NOT_FOUND'
