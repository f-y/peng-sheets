import json

import headless_editor
from headless_editor import clear_columns, delete_columns, initialize_workbook

# Reuse mock config
MOCK_CONFIG = json.dumps(
    {"rootMarker": "# Tables", "sheetHeaderLevel": 2, "tableHeaderLevel": 3}
)


def setup_simple_table():
    md = """# Tables
## S1
### T1
| A | B | C | D |
|---|---|---|---|
| 1 | 2 | 3 | 4 |
| 5 | 6 | 7 | 8 |
"""
    initialize_workbook(md, MOCK_CONFIG)
    return 0, 0  # sheet_idx, table_idx


def test_delete_multiple_columns_contiguous():
    sheet, table = setup_simple_table()
    # Delete B(1) and C(2)
    res = delete_columns(sheet, table, [1, 2])
    assert "content" in res
    rows = headless_editor.workbook.sheets[0].tables[0].rows
    # Expected: A(0), D(3) -> New 0, 1
    assert len(rows[0]) == 2
    assert rows[0] == ["1", "4"]
    assert rows[1] == ["5", "8"]


def test_delete_multiple_columns_non_contiguous():
    sheet, table = setup_simple_table()
    # Delete A(0) and C(2)
    res = delete_columns(
        sheet, table, [0, 2]
    )  # List order shouldn't matter if logic handles sorting
    assert "content" in res
    rows = headless_editor.workbook.sheets[0].tables[0].rows
    # Expected: B(1), D(3) -> New 0, 1
    assert rows[0] == ["2", "4"]


def test_delete_columns_unsorted_input():
    sheet, table = setup_simple_table()
    # Delete C(2) and A(0) passed as [0, 2] or [2, 0]
    res = delete_columns(sheet, table, [0, 2])
    rows = headless_editor.workbook.sheets[0].tables[0].rows
    assert rows[0] == ["2", "4"]

    sheet, table = setup_simple_table()
    res = delete_columns(sheet, table, [2, 0])
    rows = headless_editor.workbook.sheets[0].tables[0].rows
    assert rows[0] == ["2", "4"]


def test_clear_multiple_columns():
    sheet, table = setup_simple_table()
    # Clear B(1) and D(3)
    res = clear_columns(sheet, table, [1, 3])
    assert "content" in res
    rows = headless_editor.workbook.sheets[0].tables[0].rows
    # Expected: A(0) kept, B(1) empty, C(2) kept, D(3) empty
    assert rows[0] == ["1", "", "3", ""]
    assert rows[1] == ["5", "", "7", ""]


def test_delete_columns_metadata_shifting():
    # Setup table with metadata
    md = """# Tables
## S1
### T1
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
"""
    initialize_workbook(md, MOCK_CONFIG)
    # Inject metadata manually for test
    t = headless_editor.workbook.sheets[0].tables[0]
    # Initialize visual metadata structure if not present
    if "visual" not in t.metadata:
        t.metadata["visual"] = {}

    t.metadata["visual"]["column_widths"] = {"0": 10, "1": 20, "2": 30}

    # Delete B(1)
    # Expected: B(1) deleted. C(2) becomes index 1.
    # 0 -> 0 (10)
    # 1 -> deleted
    # 2 -> 1 (30)
    delete_columns(0, 0, [1])

    t = headless_editor.workbook.sheets[0].tables[0]
    vm = t.metadata["visual"]["column_widths"]
    assert vm.get("0") == 10
    assert vm.get("1") == 30
    assert "2" not in vm
