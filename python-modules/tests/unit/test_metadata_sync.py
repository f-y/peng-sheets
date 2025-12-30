from unittest.mock import MagicMock, patch

import pytest
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import table as table_service
from md_spreadsheet_parser import Sheet, Table, Workbook


@pytest.fixture
def mock_context():
    context = MagicMock()
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
def test_insert_column_shifts_validation(
    mock_apply_update, mock_context, sample_workbook
):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Setup initial metadata: Validation on Column 0
    # sample_workbook tables[0] has 2 columns (0, 1)
    sheet = sample_workbook.sheets[0]
    table = sheet.tables[0]
    table.metadata["validation"] = {"0": {"type": "list", "values": ["A", "B", "C"]}}

    # Insert new column at index 0.
    # Old Column 0 should become Column 1.
    # Validation metadata for "0" should move to "1".
    table_service.insert_column(mock_context, 0, 0, 0)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    validation = new_table.metadata.get("validation", {})

    # Current behavior (Bug): "0" likely stays valid for the *new* column (or is wiped?),
    # but we want the rule associated with the *data* to move with the data.
    # If I insert at 0, the old col 0 data moves to col 1. The validation rule should move to "1".

    assert "1" in validation, "Validation rule should have shifted to column 1"
    assert "0" not in validation, "New column 0 should not inherit validation rule"
    assert validation["1"]["type"] == "list"


@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_delete_column_shifts_validation(
    mock_apply_update, mock_context, sample_workbook
):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Setup initial metadata: Validation on Column 1
    sheet = sample_workbook.sheets[0]
    table = sheet.tables[0]
    # Col 0: A, C
    # Col 1: B, D
    table.metadata["validation"] = {"1": {"type": "integer"}}

    # Delete Column 0.
    # Old Column 1 becomes Column 0.
    # Validation metadata for "1" should move to "0".
    table_service.delete_columns(mock_context, 0, 0, [0])

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    validation = new_table.metadata.get("validation", {})

    assert "0" in validation, "Validation rule should have shifted to column 0"
    assert "1" not in validation, "Old column index should be gone"
    assert validation["0"]["type"] == "integer"
@patch("md_spreadsheet_editor.services.table.apply_sheet_update")
def test_move_columns_shifts_validation(
    mock_apply_update, mock_context, sample_workbook
):
    mock_context.workbook = sample_workbook
    mock_apply_update.return_value = {"file_changed": True}

    # Setup initial metadata
    sheet = sample_workbook.sheets[0]
    table = sheet.tables[0]
    # Current: [Col 1, Col 2]  (Indices 0, 1)
    # Metadata: 0 -> Rule A, 1 -> Rule B
    table.metadata["validation"] = {"0": {"type": "A"}, "1": {"type": "B"}}

    # Move Column 0 to Index 2 (After Col 1, effectively Swap 0->1, 1->0)
    # Wait, move logic: move cols [0] to target 2.
    # [Col 1, Col 2] -> Move 0 to after 1 -> [Col 2, Col 1]
    # Old 0 becomes New 1. Old 1 becomes New 0.

    table_service.move_columns(mock_context, 0, 0, [0], 2)

    args = mock_apply_update.call_args[0]
    transform_func = args[2]
    new_sheet = transform_func(sample_workbook.sheets[0])
    new_table = new_sheet.tables[0]

    validation = new_table.metadata.get("validation", {})

    assert "0" in validation
    assert "1" in validation

    # Old 0 (Rule A) should be at New 1
    assert validation["1"]["type"] == "A"

    # Old 1 (Rule B) should be at New 0
    assert validation["0"]["type"] == "B"
