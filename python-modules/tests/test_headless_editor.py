import json

import headless_editor
import md_spreadsheet_parser
import pytest
from headless_editor import (
    add_sheet,
    clear_column,
    delete_row,
    delete_sheet,
    initialize_workbook,
    rename_sheet,
    update_cell,
    workbook,
)
from md_spreadsheet_parser import Sheet, Table, Workbook

# Mock Config
MOCK_CONFIG = json.dumps(
    {"rootMarker": "# Tables", "sheetHeaderLevel": 2, "tableHeaderLevel": 3}
)

MOCK_MD = """# My Doc

Some text.

# Tables

## Sheet1

### Table1
| A | B |
|---|---|
| 1 | 2 |

"""


def test_initialize():
    initialize_workbook(MOCK_MD, MOCK_CONFIG)
    assert headless_editor.workbook is not None
    assert len(headless_editor.workbook.sheets) == 1
    assert headless_editor.workbook.sheets[0].name == "Sheet1"


def test_add_sheet():
    initialize_workbook(MOCK_MD, MOCK_CONFIG)
    res = add_sheet("Sheet2")
    assert "content" in res
    assert "## Sheet2" in res["content"]
    assert "| A | B | C |" in res["content"]
    assert len(headless_editor.workbook.sheets) == 2


def test_add_sheet_empty_workbook():
    headless_editor.workbook = None
    headless_editor.md_text = ""
    headless_editor.config = MOCK_CONFIG

    res = add_sheet("Sheet1")
    assert "content" in res
    assert "## Sheet1" in res["content"]


def test_operations():
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    # Update Cell
    res = update_cell(0, 0, 0, 0, "Updated")
    assert "content" in res, f"Error: {res.get('error')}"
    assert "| Updated |" in res["content"]

    # Delete Row
    res = delete_row(0, 0, 0)  # Deleting row 0 of table 0 sheet 0
    assert "content" in res
    # Should result in empty table body if it had 1 row
    assert headless_editor.workbook.sheets[0].tables[0].rows == []


def test_clear_column():
    md = """# Tables
## S1
### T1
| A | B |
|---|---|
| 1 | 2 |
"""
    initialize_workbook(md, MOCK_CONFIG)

    res = clear_column(0, 0, 0)
    assert "content" in res
    rows = headless_editor.workbook.sheets[0].tables[0].rows
    assert rows[0][0] == ""
    assert rows[0][1] == "2"
