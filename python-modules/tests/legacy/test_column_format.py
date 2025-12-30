"""Tests for update_column_format function in headless_editor."""

import json

import headless_editor
from headless_editor import (
    initialize_workbook,
    update_column_align,
    update_column_format,
)

# Mock Config
MOCK_CONFIG = json.dumps(
    {"rootMarker": "# Tables", "sheetHeaderLevel": 2, "tableHeaderLevel": 3}
)

MOCK_MD = """# Tables

## Sheet1

### Table1
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
| 4 | 5 | 6 |

"""


def test_update_column_format_wordwrap_false():
    """Test setting wordWrap to false for a column."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    format_config = {"wordWrap": False}
    res = update_column_format(0, 0, 0, format_config)

    assert "content" in res, f"Error: {res.get('error')}"

    # Check metadata was updated
    table = headless_editor.workbook.sheets[0].tables[0]
    visual = table.metadata.get("visual", {})
    columns = visual.get("columns", {})
    col_0 = columns.get("0", {})

    assert col_0.get("format") == {"wordWrap": False}


def test_update_column_format_number_format():
    """Test setting number format with thousands separator."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    format_config = {
        "numberFormat": {"type": "number", "decimals": 2, "useThousandsSeparator": True}
    }
    res = update_column_format(0, 0, 1, format_config)

    assert "content" in res

    table = headless_editor.workbook.sheets[0].tables[0]
    visual = table.metadata.get("visual", {})
    columns = visual.get("columns", {})
    col_1 = columns.get("1", {})

    assert col_1.get("format") == format_config


def test_update_column_format_currency():
    """Test setting currency format."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    format_config = {
        "numberFormat": {"type": "currency", "currencySymbol": "$", "decimals": 2}
    }
    res = update_column_format(0, 0, 2, format_config)

    assert "content" in res

    table = headless_editor.workbook.sheets[0].tables[0]
    visual = table.metadata.get("visual", {})
    columns = visual.get("columns", {})
    col_2 = columns.get("2", {})

    assert col_2.get("format")["numberFormat"]["type"] == "currency"
    assert col_2.get("format")["numberFormat"]["currencySymbol"] == "$"


def test_update_column_format_percent():
    """Test setting percent format."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    format_config = {"numberFormat": {"type": "percent", "decimals": 1}}
    res = update_column_format(0, 0, 0, format_config)

    assert "content" in res

    table = headless_editor.workbook.sheets[0].tables[0]
    col_0 = table.metadata["visual"]["columns"]["0"]

    assert col_0["format"]["numberFormat"]["type"] == "percent"
    assert col_0["format"]["numberFormat"]["decimals"] == 1


def test_update_column_format_clear():
    """Test clearing format settings by passing empty/None config."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    # First set a format
    format_config = {"wordWrap": False}
    update_column_format(0, 0, 0, format_config)

    # Now clear it
    res = update_column_format(0, 0, 0, None)

    assert "content" in res

    table = headless_editor.workbook.sheets[0].tables[0]
    visual = table.metadata.get("visual", {})
    columns = visual.get("columns", {})
    col_0 = columns.get("0", {})

    # Format should be removed
    assert "format" not in col_0


def test_update_column_format_preserves_existing_column_settings():
    """Test that format update preserves existing column settings.

    Note: Since GFM alignment is now stored in table.alignments (not metadata),
    this test verifies that alignment and format coexist in their respective locations.
    """
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    # First set alignment (stored in table.alignments for GFM)
    update_column_align(0, 0, 0, "center")

    # Then set format (stored in metadata)
    format_config = {"wordWrap": False}
    res = update_column_format(0, 0, 0, format_config)

    assert "content" in res

    table = headless_editor.workbook.sheets[0].tables[0]

    # Alignment should be in table.alignments (GFM)
    assert table.alignments[0] == "center"

    # Format should be in metadata
    col_0 = table.metadata["visual"]["columns"]["0"]
    assert col_0.get("format") == {"wordWrap": False}


def test_update_column_format_multiple_columns():
    """Test setting different formats on multiple columns."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    # Set different formats for each column
    update_column_format(0, 0, 0, {"wordWrap": False})
    update_column_format(0, 0, 1, {"numberFormat": {"type": "number", "decimals": 2}})
    update_column_format(0, 0, 2, {"numberFormat": {"type": "percent", "decimals": 0}})

    table = headless_editor.workbook.sheets[0].tables[0]
    columns = table.metadata["visual"]["columns"]

    assert columns["0"]["format"] == {"wordWrap": False}
    assert columns["1"]["format"]["numberFormat"]["type"] == "number"
    assert columns["2"]["format"]["numberFormat"]["type"] == "percent"


def test_update_column_format_combined_settings():
    """Test setting both wordWrap and numberFormat together."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    format_config = {
        "wordWrap": False,
        "numberFormat": {
            "type": "currency",
            "currencySymbol": "¥",
            "decimals": 0,
            "useThousandsSeparator": True,
        },
    }
    res = update_column_format(0, 0, 0, format_config)

    assert "content" in res

    table = headless_editor.workbook.sheets[0].tables[0]
    col_0 = table.metadata["visual"]["columns"]["0"]["format"]

    assert col_0["wordWrap"] is False
    assert col_0["numberFormat"]["type"] == "currency"
    assert col_0["numberFormat"]["currencySymbol"] == "¥"


def test_update_column_format_invalid_sheet_index():
    """Test that invalid sheet index returns error."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    res = update_column_format(99, 0, 0, {"wordWrap": False})

    assert "error" in res


def test_update_column_format_invalid_table_index():
    """Test that invalid table index returns error."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    res = update_column_format(0, 99, 0, {"wordWrap": False})

    assert "error" in res


def test_update_column_format_metadata_stored_for_persistence():
    """Test that column format is stored in table metadata for persistence."""
    initialize_workbook(MOCK_MD, MOCK_CONFIG)

    format_config = {
        "numberFormat": {"type": "number", "decimals": 2, "useThousandsSeparator": True}
    }
    res = update_column_format(0, 0, 0, format_config)

    assert "content" in res

    # Verify the metadata structure that md-spreadsheet-parser will serialize
    table = headless_editor.workbook.sheets[0].tables[0]
    assert "visual" in table.metadata
    assert "columns" in table.metadata["visual"]
    assert "0" in table.metadata["visual"]["columns"]
    assert "format" in table.metadata["visual"]["columns"]["0"]
    assert (
        table.metadata["visual"]["columns"]["0"]["format"]["numberFormat"]["type"]
        == "number"
    )
