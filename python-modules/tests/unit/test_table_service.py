from unittest.mock import MagicMock, patch

import pytest
from md_spreadsheet_editor.services import table as table_service
from md_spreadsheet_parser import Sheet, Table, Workbook


@pytest.fixture
def mock_context():
    context = MagicMock()
    # Mock update_state to record changes
    context.update_state = MagicMock()
    return context


@pytest.fixture
def sample_workbook():
    tables = [
        Table(
            name="Table 1",
            description="",
            headers=["Col 1", "Col 2"],
            rows=[["A", "B"], ["C", "D"]],
            metadata={},
        )
    ]
    sheet = Sheet(name="Sheet 1", tables=tables)
    return Workbook(sheets=[sheet], metadata={})


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_cell(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Test updating a cell
    result = table_service.update_cell(mock_context, 0, 0, 0, 0, "New Value")

    assert result
    assert result.get("file_changed")

    mock_apply_update.assert_called_once()
    args = mock_apply_update.call_args[0]
    transform_func = args[2]

    sheet = sample_workbook.sheets[0]
    new_sheet = transform_func(sheet)
    new_table = new_sheet.tables[0]

    assert new_table.rows[0][0] == "New Value"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_insert_row(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.insert_row(mock_context, 0, 0, 1)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    sheet = sample_workbook.sheets[0]
    new_sheet = transform_func(sheet)
    new_table = new_sheet.tables[0]

    assert len(new_table.rows) == 3
    assert new_table.rows[1] == ["", ""]
    assert new_table.rows[2] == ["C", "D"]


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_delete_rows(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.delete_rows(mock_context, 0, 0, [1])

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    sheet = sample_workbook.sheets[0]
    new_sheet = transform_func(sheet)
    new_table = new_sheet.tables[0]

    assert len(new_table.rows) == 1
    assert new_table.rows[0] == ["A", "B"]


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_move_rows(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.move_rows(mock_context, 0, 0, [0], 2)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    sheet = sample_workbook.sheets[0]
    new_sheet = transform_func(sheet)
    new_table = new_sheet.tables[0]

    assert new_table.rows[0] == ["C", "D"]
    assert new_table.rows[1] == ["A", "B"]


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_sort_rows(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.sort_rows(mock_context, 0, 0, 0, False)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    sheet = sample_workbook.sheets[0]
    new_sheet = transform_func(sheet)
    new_table = new_sheet.tables[0]

    assert new_table.rows[0][0] == "C"
    assert new_table.rows[1][0] == "A"


# --- Column Operations Tests ---


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_insert_column(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Insert new column at index 1
    table_service.insert_column(mock_context, 0, 0, 1)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # Original Headers: Col 1, Col 2
    # New: Col 1, New Column 1, Col 2
    assert len(new_table.headers) == 3
    # Note: Default name logic might vary, checking length primarily or mocked name
    assert len(new_table.rows[0]) == 3
    assert new_table.rows[0][1] == ""


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_delete_columns(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Delete column 0
    table_service.delete_columns(mock_context, 0, 0, [0])

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    assert len(new_table.headers) == 1
    assert new_table.headers[0] == "Col 2"
    assert len(new_table.rows[0]) == 1
    assert new_table.rows[0][0] == "B"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_move_columns(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Move Col 0 to end (index 2)
    # Original: C1, C2
    # Target: C2, C1
    table_service.move_columns(mock_context, 0, 0, [0], 2)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    assert new_table.headers[0] == "Col 2"
    assert new_table.headers[1] == "Col 1"
    assert new_table.rows[0][0] == "B"
    assert new_table.rows[0][1] == "A"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_clear_columns(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Clear Col 0 (Should become empty strings)
    table_service.clear_columns(mock_context, 0, 0, [0])

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    assert new_table.rows[0][0] == ""
    assert new_table.rows[1][0] == ""
    # Other column unchanged
    assert new_table.rows[0][1] == "B"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_column_width(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.update_column_width(mock_context, 0, 0, 0, 150)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # Check metadata structure
    # metadata['visual']['columns']['0']['width'] should be 150
    visual = new_table.metadata.get("visual", {})
    col_meta = visual.get("columns", {}).get("0", {})
    assert col_meta.get("width") == 150


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_column_align(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Align Col 0 to 'right'
    table_service.update_column_align(mock_context, 0, 0, 0, "right")

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # alignments is a list in Table object if I recall, but let's check parser lib or usage.
    # The Table dataclass has 'alignments' field.
    assert new_table.alignments is not None
    assert new_table.alignments[0] == "right"
    # Also check other column default (usually 'left' or None)
    # The sample provided originally had alignments=None?
    # Wait, sample_workbook fixture created Table with alignments=None.
    # So we need to ensure helper expands it correctly.
    assert len(new_table.alignments) == 2


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_column_format(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Set format for Col 0 to 'currency'
    table_service.update_column_format(mock_context, 0, 0, 0, "currency")

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    visual = new_table.metadata.get("visual", {})
    col_meta = visual.get("columns", {}).get("0", {})
    assert col_meta.get("format") == "currency"


# --- Cell Operations Tests ---


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_paste_cells_simple(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    new_data = [["X", "Y"], ["Z", "W"]]
    # Paste at 0,0 Oerwrites existing A, B, C, D which are at 0,0 to 1,1
    table_service.paste_cells(mock_context, 0, 0, 0, 0, new_data)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    assert new_table.rows[0] == ["X", "Y"]
    assert new_table.rows[1] == ["Z", "W"]


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_paste_cells_expand(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Paste causing usage of new rows/columns
    # Existing: 2x2. Paste at 1,1 (cell D). Data: 2x2.
    # Should extend to row 3, col 3.
    new_data = [["N1", "N2"], ["N3", "N4"]]
    table_service.paste_cells(mock_context, 0, 0, 1, 1, new_data)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # Check dimensions
    # Rows: 0 (A,B), 1 (C, N1, N2), 2 ("", N3, N4)
    # Headers should expand? "Col 3"?
    assert len(new_table.rows) == 3
    assert len(new_table.headers) == 3  # Expanded by 1 col

    # Check values
    assert new_table.rows[1][1] == "N1"
    assert new_table.rows[1][2] == "N2"
    assert new_table.rows[2][1] == "N3"
    assert new_table.rows[2][2] == "N4"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_move_cells(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Move A (0,0) to 2,2
    # Source Range: 0,0 to 0,0
    src_range = {"minR": 0, "maxR": 0, "minC": 0, "maxC": 0}
    dest_row = 2
    dest_col = 2

    table_service.move_cells(mock_context, 0, 0, src_range, dest_row, dest_col)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # Check source cleared
    assert new_table.rows[0][0] == ""

    # Check destination
    # Grid should expand to at least 3x3 to hold (2,2)
    assert len(new_table.rows) >= 3
    assert len(new_table.rows[2]) >= 3
    assert new_table.rows[2][2] == "A"


def test_escape_pipe():
    assert table_service._escape_pipe("start | end") == "start \\| end"
    assert table_service._escape_pipe("no pipe") == "no pipe"
    assert table_service._escape_pipe("start \\| end") == "start \\| end"
    assert table_service._escape_pipe("`|`") == "`|`"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_table_metadata(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.update_table_metadata(mock_context, 0, 0, "New Name", "New Desc")

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    assert new_table.name == "New Name"
    assert new_table.description == "New Desc"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_visual_metadata(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    visual_meta = {"filters": {"0": ["hidden"]}, "columns": {"0": {"width": 100}}}
    table_service.update_visual_metadata(mock_context, 0, 0, visual_meta)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # Check if visual metadata is updated
    # Note: sample_workbook table has empty metadata initially
    assert new_table.metadata["visual"] == visual_meta


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_update_column_filter(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    table_service.update_column_filter(mock_context, 0, 0, 0, ["hidden"])

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    visual = new_table.metadata.get("visual", {})
    filters = visual.get("filters", {})
    assert filters["0"] == ["hidden"]


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_insert_column_with_name(mock_apply_update, mock_context, sample_workbook):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Insert new column with custom name
    custom_name = "Localized Column"
    table_service.insert_column(mock_context, 0, 0, 1, custom_name)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    # Verify custom name is used
    assert new_table.headers[1] == custom_name
