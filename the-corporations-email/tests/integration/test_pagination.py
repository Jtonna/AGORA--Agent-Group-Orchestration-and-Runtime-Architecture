"""
Integration tests for pagination functionality.

Tests pagination behavior across all paginated endpoints:
- GET /mail (inbox): 10 per page
- GET /mail/{id} (thread): 20 per page
- GET /investigation/{name}: 20 per page
"""

import pytest
import json

from models import Email
from storage import EmailStorage


class TestInboxPagination:
    """Tests for GET /mail pagination (10 per page)."""

    @pytest.fixture
    def many_emails_storage(self, fresh_storage):
        """Create storage with 25 emails for alice's inbox."""
        for i in range(25):
            email = Email(
                id=f"00000000-0000-0000-0000-{str(i+1).zfill(12)}",
                to=["alice"],
                from_="bob",
                subject=f"Email {i+1}",
                content=f"Content {i+1}",
                timestamp=f"2024-01-{str(i+1).zfill(2)}T10:00:00Z"
            )
            fresh_storage.create(email)
        return fresh_storage

    @pytest.fixture
    def many_emails_client(self, many_emails_storage):
        """Flask client with 25 emails."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_page_1_returns_first_10(self, many_emails_client):
        """Page 1 returns first 10 emails (newest first)."""
        response = many_emails_client.get('/mail?viewer=alice&page=1')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']) == 10
        # Should be newest first (email 25, 24, 23...)
        assert data['data'][0]['subject'] == 'Email 25'
        assert data['data'][9]['subject'] == 'Email 16'

    def test_page_2_returns_next_10(self, many_emails_client):
        """Page 2 returns next 10 emails."""
        response = many_emails_client.get('/mail?viewer=alice&page=2')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']) == 10
        # Should be emails 15-6
        assert data['data'][0]['subject'] == 'Email 15'
        assert data['data'][9]['subject'] == 'Email 6'

    def test_last_page_returns_remaining(self, many_emails_client):
        """Last page returns remaining emails."""
        response = many_emails_client.get('/mail?viewer=alice&page=3')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']) == 5  # 25 - 20 = 5 remaining
        # Should be emails 5-1
        assert data['data'][0]['subject'] == 'Email 5'
        assert data['data'][4]['subject'] == 'Email 1'

    def test_page_0_returns_error(self, many_emails_client):
        """Page 0 returns error."""
        response = many_emails_client.get('/mail?viewer=alice&page=0')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_negative_page_returns_error(self, many_emails_client):
        """Negative page returns error."""
        response = many_emails_client.get('/mail?viewer=alice&page=-1')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_non_numeric_page_returns_error(self, many_emails_client):
        """Non-numeric page returns error."""
        response = many_emails_client.get('/mail?viewer=alice&page=abc')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_page_exceeding_total_returns_error(self, many_emails_client):
        """Page exceeding total pages returns error."""
        response = many_emails_client.get('/mail?viewer=alice&page=10')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_empty_inbox_returns_page_1(self, app_client):
        """Empty inbox returns valid page 1 with empty data."""
        response = app_client.get('/mail?viewer=nonexistent')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data'] == []
        assert data['pagination']['page'] == 1
        assert data['pagination']['total_items'] == 0
        assert data['pagination']['total_pages'] == 1

    def test_pagination_metadata_accuracy(self, many_emails_client):
        """Pagination metadata is accurate."""
        response = many_emails_client.get('/mail?viewer=alice&page=1')
        data = response.get_json()
        pagination = data['pagination']
        assert pagination['page'] == 1
        assert pagination['per_page'] == 10
        assert pagination['total_items'] == 25
        assert pagination['total_pages'] == 3
        assert pagination['has_next'] is True
        assert pagination['has_prev'] is False

    def test_page_2_has_prev(self, many_emails_client):
        """Page 2 has_prev is true."""
        response = many_emails_client.get('/mail?viewer=alice&page=2')
        data = response.get_json()
        assert data['pagination']['has_prev'] is True
        assert data['pagination']['has_next'] is True

    def test_last_page_has_no_next(self, many_emails_client):
        """Last page has_next is false."""
        response = many_emails_client.get('/mail?viewer=alice&page=3')
        data = response.get_json()
        assert data['pagination']['has_next'] is False
        assert data['pagination']['has_prev'] is True

    def test_default_page_is_1(self, many_emails_client):
        """Without page param, defaults to page 1."""
        response = many_emails_client.get('/mail?viewer=alice')
        data = response.get_json()
        assert data['pagination']['page'] == 1
        assert len(data['data']) == 10


class TestThreadPagination:
    """Tests for GET /mail/{id} thread pagination (20 per page)."""

    @pytest.fixture
    def deep_thread_storage(self, fresh_storage):
        """Create storage with a thread of 50 emails."""
        # Create root email
        root = Email(
            id="00000000-0000-0000-0000-000000000001",
            to=["alice"],
            from_="bob",
            subject="Root Email",
            content="Root content",
            timestamp="2024-01-01T10:00:00Z"
        )
        fresh_storage.create(root)

        # Create 49 replies (total 50 in thread)
        for i in range(49):
            email = Email(
                id=f"00000000-0000-0000-0000-{str(i+2).zfill(12)}",
                to=["alice"],
                from_="bob",
                subject=f"Re: Root Email",
                content=f"Reply {i+1}",
                timestamp=f"2024-01-{str(i+2).zfill(2)}T10:00:00Z",
                is_response_to="00000000-0000-0000-0000-000000000001"
            )
            fresh_storage.create(email)

        return fresh_storage

    @pytest.fixture
    def deep_thread_client(self, deep_thread_storage):
        """Flask client with 50-email thread."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_thread_page_1_returns_first_20(self, deep_thread_client):
        """Thread page 1 returns first 20 thread emails."""
        # View the root email
        response = deep_thread_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=alice&thread_page=1')
        assert response.status_code == 200
        data = response.get_json()
        # Thread excludes the viewed email, so 49 emails in thread
        assert len(data['thread']) == 20
        # Thread is sorted newest first
        assert data['thread_pagination']['total_in_thread'] == 49

    def test_thread_page_2_returns_next_20(self, deep_thread_client):
        """Thread page 2 returns next 20 emails."""
        response = deep_thread_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=alice&thread_page=2')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['thread']) == 20

    def test_thread_last_page_returns_remaining(self, deep_thread_client):
        """Thread last page returns remaining emails."""
        response = deep_thread_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=alice&thread_page=3')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['thread']) == 9  # 49 - 40 = 9 remaining

    def test_empty_thread_returns_empty_array(self, app_client):
        """Single email has empty thread."""
        # Create a single email
        response = app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Solo Email",
                "content": "No thread"
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
        assert data['thread_pagination']['page'] == 1
        assert data['thread_pagination']['total_pages'] == 1

    def test_invalid_thread_page_returns_error(self, deep_thread_client):
        """Invalid thread_page returns error."""
        response = deep_thread_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=alice&thread_page=abc')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_thread_per_page_is_20(self, deep_thread_client):
        """Thread pagination is 20 per page."""
        response = deep_thread_client.get('/mail/00000000-0000-0000-0000-000000000001?viewer=alice&thread_page=1')
        data = response.get_json()
        assert data['thread_pagination']['per_page'] == 20


class TestInvestigationPagination:
    """Tests for GET /investigation/{name} pagination (20 per page)."""

    @pytest.fixture
    def many_investigation_emails(self, fresh_storage):
        """Create 50 emails involving alice for investigation."""
        for i in range(50):
            email = Email(
                id=f"00000000-0000-0000-0000-{str(i+1).zfill(12)}",
                to=["alice"],
                from_="bob",
                subject=f"Investigation Email {i+1}",
                content=f"Content {i+1}",
                timestamp=f"2024-01-{str(i+1).zfill(2)}T10:00:00Z"
            )
            fresh_storage.create(email)
        return fresh_storage

    @pytest.fixture
    def investigation_client(self, many_investigation_emails):
        """Flask client with 50 emails for investigation."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_page_1_returns_first_20(self, investigation_client):
        """Investigation page 1 returns first 20 emails."""
        response = investigation_client.get('/investigation/alice?page=1')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']) == 20

    def test_page_2_returns_next_20(self, investigation_client):
        """Investigation page 2 returns next 20 emails."""
        response = investigation_client.get('/investigation/alice?page=2')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']) == 20

    def test_last_page_returns_remaining(self, investigation_client):
        """Investigation last page returns remaining emails."""
        response = investigation_client.get('/investigation/alice?page=3')
        assert response.status_code == 200
        data = response.get_json()
        assert len(data['data']) == 10  # 50 - 40 = 10 remaining

    def test_empty_results_returns_page_1(self, app_client):
        """Empty investigation results return valid page 1."""
        response = app_client.get('/investigation/nobody')
        assert response.status_code == 200
        data = response.get_json()
        assert data['data'] == []
        assert data['pagination']['page'] == 1
        assert data['pagination']['total_items'] == 0

    def test_invalid_page_returns_error(self, investigation_client):
        """Invalid page returns error."""
        response = investigation_client.get('/investigation/alice?page=-1')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_investigation_per_page_is_20(self, investigation_client):
        """Investigation pagination is 20 per page."""
        response = investigation_client.get('/investigation/alice?page=1')
        data = response.get_json()
        assert data['pagination']['per_page'] == 20


class TestPaginationMetadata:
    """Tests for pagination metadata accuracy across endpoints."""

    @pytest.fixture
    def exact_page_storage(self, fresh_storage):
        """Create storage with exactly 20 emails (2 full pages for inbox)."""
        for i in range(20):
            email = Email(
                id=f"00000000-0000-0000-0000-{str(i+1).zfill(12)}",
                to=["alice"],
                from_="bob",
                subject=f"Email {i+1}",
                content=f"Content {i+1}",
                timestamp=f"2024-01-{str(i+1).zfill(2)}T10:00:00Z"
            )
            fresh_storage.create(email)
        return fresh_storage

    @pytest.fixture
    def exact_page_client(self, exact_page_storage):
        """Flask client with exactly 20 emails."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_total_items_accurate(self, exact_page_client):
        """total_items reflects actual count."""
        response = exact_page_client.get('/mail?viewer=alice')
        data = response.get_json()
        assert data['pagination']['total_items'] == 20

    def test_total_pages_calculation(self, exact_page_client):
        """total_pages calculation is correct."""
        response = exact_page_client.get('/mail?viewer=alice')
        data = response.get_json()
        # 20 emails / 10 per page = 2 pages
        assert data['pagination']['total_pages'] == 2

    def test_has_next_on_first_page(self, exact_page_client):
        """has_next is true on first page when more pages exist."""
        response = exact_page_client.get('/mail?viewer=alice&page=1')
        data = response.get_json()
        assert data['pagination']['has_next'] is True

    def test_has_next_false_on_last_page(self, exact_page_client):
        """has_next is false on last page."""
        response = exact_page_client.get('/mail?viewer=alice&page=2')
        data = response.get_json()
        assert data['pagination']['has_next'] is False

    def test_has_prev_false_on_first_page(self, exact_page_client):
        """has_prev is false on first page."""
        response = exact_page_client.get('/mail?viewer=alice&page=1')
        data = response.get_json()
        assert data['pagination']['has_prev'] is False

    def test_has_prev_true_on_page_2(self, exact_page_client):
        """has_prev is true on page 2."""
        response = exact_page_client.get('/mail?viewer=alice&page=2')
        data = response.get_json()
        assert data['pagination']['has_prev'] is True

    def test_single_item_pagination(self, app_client):
        """Single item has correct pagination."""
        # Create one email
        app_client.post(
            '/mail',
            data=json.dumps({
                "to": ["alice"],
                "from": "bob",
                "subject": "Single Email",
                "content": "Only one"
            }),
            content_type='application/json; charset=utf-8'
        )

        response = app_client.get('/mail?viewer=alice')
        data = response.get_json()
        assert data['pagination']['total_items'] == 1
        assert data['pagination']['total_pages'] == 1
        assert data['pagination']['has_next'] is False
        assert data['pagination']['has_prev'] is False


class TestPageParamFormats:
    """Tests for various page parameter formats."""

    @pytest.fixture
    def basic_emails_storage(self, fresh_storage):
        """Create storage with 15 emails."""
        for i in range(15):
            email = Email(
                id=f"00000000-0000-0000-0000-{str(i+1).zfill(12)}",
                to=["alice"],
                from_="bob",
                subject=f"Email {i+1}",
                content=f"Content {i+1}",
                timestamp=f"2024-01-{str(i+1).zfill(2)}T10:00:00Z"
            )
            fresh_storage.create(email)
        return fresh_storage

    @pytest.fixture
    def basic_client(self, basic_emails_storage):
        """Flask client with 15 emails."""
        from app import app
        app.config['TESTING'] = True
        with app.test_client() as client:
            yield client

    def test_string_page_number(self, basic_client):
        """String '2' is accepted as page number."""
        response = basic_client.get('/mail?viewer=alice&page=2')
        assert response.status_code == 200
        data = response.get_json()
        assert data['pagination']['page'] == 2

    def test_float_page_rejected(self, basic_client):
        """Float '1.5' is rejected."""
        response = basic_client.get('/mail?viewer=alice&page=1.5')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_large_page_number(self, basic_client):
        """Page number larger than total pages is rejected."""
        response = basic_client.get('/mail?viewer=alice&page=999')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'

    def test_whitespace_page_rejected(self, basic_client):
        """Whitespace in page is rejected."""
        response = basic_client.get('/mail?viewer=alice&page=%20%20')
        assert response.status_code == 400
        data = response.get_json()
        assert data['code'] == 'INVALID_PAGE'
