from unittest.mock import MagicMock

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


def test_update_cell(mock_context, sample_workbook):
    mock_context.workbook = sample_workbook

    # Test updating a cell
    result = table_service.update_cell(mock_context, 0, 0, 0, 0, "New Value")

    assert "error" not in result
    assert result.get("file_changed")

    # Verify update_workbook was called with correct transform
    mock_context.update_state.assert_called()


def test_escape_pipe():
    # Helper should handle pipe escaping
    assert table_service._escape_pipe("start | end") == "start \\| end"
    assert table_service._escape_pipe("no pipe") == "no pipe"
    assert (
        table_service._escape_pipe("start \\| end") == "start \\| end"
    )  # Already escaped
    assert table_service._escape_pipe("`|`") == "`|`"  # Code block
