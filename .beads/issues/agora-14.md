# Implement Pagination Helpers

**Type:** task
**Status:** open
**Epic:** agora-11 (Phase 2 - Services Layer)
**Priority:** high
**Assignee:** Employee

## Description

Create reusable pagination helper functions.

## Functions to Implement

### `paginate(items: List, page: int, per_page: int) -> dict`

Generic pagination function.

```python
def paginate(items: List, page: int, per_page: int) -> dict:
    """
    Paginate a list of items.

    Args:
        items: List to paginate
        page: Page number (1-indexed)
        per_page: Items per page

    Returns:
        {
            "data": [...],  # Items for this page
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
        InvalidPageError if page < 1 or page > total_pages (when items exist)
    """
```

### `validate_page(page: Any) -> int`

Validate and convert page parameter.

```python
def validate_page(page: Any) -> int:
    """
    Validate page parameter.

    Args:
        page: Raw page value (could be string, int, None)

    Returns:
        Integer page number (defaults to 1 if None)

    Raises:
        InvalidPageError if not positive integer
    """
```

## Page Calculations

```python
total_pages = max(1, ceil(total_items / per_page))
start_index = (page - 1) * per_page
end_index = start_index + per_page
page_items = items[start_index:end_index]
has_next = page < total_pages
has_prev = page > 1
```

## Edge Cases

- Empty list: Return page 1 with `total_pages: 1`
- Page 0: Error `INVALID_PAGE`
- Negative page: Error `INVALID_PAGE`
- Non-numeric page: Error `INVALID_PAGE`
- Page > total_pages: Error `INVALID_PAGE`

## Acceptance Criteria

- [ ] Correct slicing for each page
- [ ] Correct total_pages calculation
- [ ] Correct has_next/has_prev
- [ ] Empty list returns page 1
- [ ] Invalid page raises error
- [ ] Works with all per_page values (10, 20)

## Dependencies

- **Blocked by:** agora-12 (service module structure)

---
**Created:** 2026-01-22
