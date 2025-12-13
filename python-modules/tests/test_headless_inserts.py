import json

from headless_editor import get_state, initialize_workbook, insert_column, insert_row


def test_insert_operations():
    md = """# Tables
## Sheet1
| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |
"""
    initialize_workbook(md, "{}")

    # Test Insert Row at 0
    res = insert_row(0, 0, 0)
    assert "error" not in res

    state = json.loads(get_state())
    rows = state["workbook"]["sheets"][0]["tables"][0]["rows"]
    assert len(rows) == 3
    assert rows[0] == ["", ""]
    assert rows[1] == ["1", "2"]

    # Test Insert Column at 1
    res = insert_column(0, 0, 1)

    state = json.loads(get_state())
    headers = state["workbook"]["sheets"][0]["tables"][0]["headers"]
    rows = state["workbook"]["sheets"][0]["tables"][0]["rows"]

    assert len(headers) == 3
    assert headers[1] == ""
    assert (
        rows[1][1] == ""
    )  # Original "1" is at [1][0], new "" at [1][1], "2" at [1][2]
    assert rows[1][0] == "1"
    assert rows[1][2] == "2"
