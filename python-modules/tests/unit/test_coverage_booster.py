import json

import pytest
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import document as document_service
from md_spreadsheet_editor.services import sheet as sheet_service
from md_spreadsheet_parser import Workbook


@pytest.fixture
def context():
    ctx = EditorContext()
    ctx.reset()
    return ctx


def test_document_parser_edge_cases(context):
    """Test ignoring non-target headers."""
    # Document Header Level is 1 (#).
    # We include Level 2 (##) which should be ignored (else branch of level check).
    md = """
# Doc 1
## Subheader (Ignored)
# Doc 2
text
"""
    context.md_text = md
    context.config = json.dumps({"docHeaderLevel": 1, "rootMarker": "# Root"})

    # Rename Doc 1. Should NOT affect Subheader.
    res = document_service.rename_document(context, 0, "New Doc 1")
    assert "## Subheader" in context.md_text
    assert "# New Doc 1" in context.md_text


def test_sheet_add_tab_order_branches(context):
    """Test add_sheet with specific tab order combinations."""
    context.workbook = Workbook(sheets=[])
    context.md_text = ""

    # 1. Add with target_tab_order_index explicitly (COVERED usually, but ensure)
    sheet_service.add_sheet(context, "S1", target_tab_order_index=0)

    # 2. Add with target_tab_order_index = None (Default append)
    sheet_service.add_sheet(context, "S2", target_tab_order_index=None)

    # 3. Add with after_sheet_index but NO target_tab_order_index
    # This hits the 'else' branch of 'if target_tab_order_index is not None' inside the cleanup logic?
    sheet_service.add_sheet(context, "S3", after_sheet_index=0)
