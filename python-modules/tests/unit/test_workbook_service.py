from unittest.mock import MagicMock

import pytest
from md_spreadsheet_editor.services import workbook as workbook_service
from md_spreadsheet_parser import Workbook


@pytest.fixture
def mock_context():
    context = MagicMock()

    # Mock update_workbook to simulate successful update
    def side_effect(wb):
        context.workbook = wb

    context.update_workbook.side_effect = side_effect
    context.workbook = Workbook(sheets=[], metadata={})
    # Mock other needed attributes
    context.md_text = ""
    context.schema = None
    context.config = None
    return context


def test_update_workbook_tab_order(mock_context):
    # Setup
    initial_wb = Workbook(sheets=[], metadata={"other": "data"})
    mock_context.workbook = initial_wb

    new_order = [{"type": "sheet", "index": 0}]

    # Call service
    # Note: This will fail until implemented
    try:
        workbook_service.update_workbook_tab_order(mock_context, new_order)
    except AttributeError:
        pytest.fail("update_workbook_tab_order not implemented")

    # Verify
    # The context.workbook should have been updated
    assert mock_context.workbook.metadata["tab_order"] == new_order
    assert mock_context.workbook.metadata["other"] == "data"
