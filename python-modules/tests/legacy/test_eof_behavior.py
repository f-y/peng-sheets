import json

from headless_editor import initialize_workbook, update_cell

MOCK_CONFIG = json.dumps(
    {"rootMarker": "# Tables", "sheetHeaderLevel": 2, "tableHeaderLevel": 3}
)


def test_eof_behavior():
    # Scenario: Document with no trailing newline
    md = """# Tables
## S1
### T1
| A |
|---|
| 1 |"""  # No trailing newline

    initialize_workbook(md, MOCK_CONFIG)

    # Update cell (0, 0, 0, 0) -> "2"
    res = update_cell(0, 0, 0, 0, "2")

    # Check Result
    # Lines: 0..5. Len=6.
    # get_workbook_range: start=0, end=6 (EOF).
    # Logic: if end >= len(lines): end = len-1 = 5. endCol = len(lines[5]) = 5 ("| 1 |").

    assert res["endLine"] == 5
    assert res["endCol"] == 5
