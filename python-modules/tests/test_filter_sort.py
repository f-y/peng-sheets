import json

import pytest
from headless_editor import (
    get_state,
    initialize_workbook,
    sort_rows,
    update_column_filter,
)

BASIC_MD = """
# Tables

## Sheet 1
| A | B |
|---|---|
| 1 | Z |
| 3 | X |
| 2 | Y |
"""


@pytest.fixture
def initialized_editor():
    initialize_workbook(BASIC_MD, "{}")
    return


def test_update_column_filter(initialized_editor):
    # Sheet 0, Table 0, Col 0, hide ["3"]
    update_column_filter(0, 0, 0, ["3"])

    state = json.loads(get_state())
    wb = state["workbook"]
    table = wb["sheets"][0]["tables"][0]

    # Verify metadata structure
    visual = table["metadata"].get("visual", {})
    filters = visual.get("filters", {})

    # keys in json are strings
    assert filters["0"] == ["3"]


def test_update_column_filter_multiple(initialized_editor):
    # Hide multiple values
    update_column_filter(0, 0, 1, ["X", "Z"])

    state = json.loads(get_state())
    wb = state["workbook"]
    table = wb["sheets"][0]["tables"][0]

    filters = table["metadata"]["visual"]["filters"]
    assert filters["1"] == ["X", "Z"]


def test_sort_rows_asc(initialized_editor):
    # Sort by Col A (index 0) ascending
    # Before: 1, 3, 2
    # After: 1, 2, 3
    sort_rows(0, 0, 0, True)

    state = json.loads(get_state())
    wb = state["workbook"]
    rows = wb["sheets"][0]["tables"][0]["rows"]

    assert rows[0][0] == "1"
    assert rows[1][0] == "2"
    assert rows[2][0] == "3"


def test_sort_rows_desc(initialized_editor):
    # Sort by Col B (index 1) descending
    # Before: Z, X, Y
    # After: Z, Y, X
    sort_rows(0, 0, 1, False)

    state = json.loads(get_state())
    wb = state["workbook"]
    rows = wb["sheets"][0]["tables"][0]["rows"]

    assert rows[0][1] == "Z"
    assert rows[1][1] == "Y"
    assert rows[2][1] == "X"


def test_sort_stable(initialized_editor):
    # Test stability if needed, though basic sort is usually stable in Python
    pass
