import json

import pytest
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import document as document_service
from md_spreadsheet_parser import Workbook


@pytest.fixture
def context():
    ctx = EditorContext()
    ctx.reset()
    # Initialize basic schema for tests
    from md_spreadsheet_parser import MultiTableParsingSchema

    ctx.update_state(schema=MultiTableParsingSchema())
    return ctx


def test_add_document_with_code_blocks(context):
    """Test adding a document when code blocks exist (coverage line 96)."""
    md = """# Doc 1

```markdown
# Ignored Header
```

# Tables
"""
    context.md_text = md
    context.workbook = Workbook(sheets=[])

    # Add document after doc 1 (index 0)
    result = document_service.add_document(context, "New Doc", after_doc_index=0)

    # Verify new doc is inserted correctly after Doc 1
    assert "error" not in result
    assert "# New Doc" in result["content"]
    # Check that "Ignored Header" inside code block was NOT treated as a document start
    # If it were, Doc index counting would be wrong.


def test_delete_document_and_get_full_update(context):
    """Test atomic delete and update (coverage lines 350-387)."""
    md = """# Doc 1

# Tables

# Doc 2
"""
    context.md_text = md
    context.workbook = Workbook(sheets=[])

    # Delete Doc 2 (Index 1)
    # Doc indices: Doc 1 (0), Doc 2 (1)
    result = document_service.delete_document_and_get_full_update(context, 1)

    assert "error" not in result
    assert "# Doc 2" not in result["content"]
    assert "# Doc 1" in result["content"]
    assert result["endLine"] == 5  # Original line count - 1
    assert result["workbook"] is not None  # Logic updates workbook state
    assert result["structure"] is not None


def test_rename_document_edge_cases(context):
    """Test rename with invalid index and tab order updates."""
    md = "# Doc 1\n# Tables"
    context.md_text = md
    context.workbook = Workbook(sheets=[])

    # Rename invalid index
    res = document_service.rename_document(context, 99, "Bad")
    assert "error" in res

    # Rename valid
    res = document_service.rename_document(context, 0, "Renamed")
    assert "error" not in res
    assert "# Renamed" in res["content"]


def test_delete_document_edge_cases(context):
    """Test delete with invalid index."""
    md = "# Doc 1\n# Tables"
    context.md_text = md
    context.workbook = Workbook(sheets=[])

    res = document_service.delete_document(context, 99)
    assert "error" in res


def test_document_service_branches(context):
    """Test specific branches in document service."""

    # 1. Rename with empty md_text
    context.md_text = ""
    res = document_service.rename_document(context, 0, "Title")
    assert "error" in res and "No markdown content" in res["error"]

    # 2. Delete with empty md_text
    context.md_text = ""
    res = document_service.delete_document(context, 0)
    assert "error" in res and "No markdown content" in res["error"]

    # 3. Rename/Delete ignoring code blocks
    md = """
```
# Not A Doc
```
# Doc 1
"""
    context.md_text = md
    context.workbook = Workbook(sheets=[])

    # Try to rename "Not A Doc" (would be index 0 if not ignored)
    # But real doc is "# Doc 1" (Index 0).
    # If we rename Index 0, it should be Doc 1.
    res = document_service.rename_document(context, 0, "Renamed")
    assert "error" not in res
    assert "# Renamed" in res["content"]
    assert "# Not A Doc" not in res["content"]

    # 4. Delete document update tab_order
    # Scenario: D0, D1, D2. Delete D1.
    # Tab Order: D0(0), D1(1), D2(2).
    # Expected: D0(0), D2(1).
    md = "# D0\n# D1\n# D2"
    context.md_text = md
    wb = Workbook(
        sheets=[],
        metadata={
            "tab_order": [
                {"type": "document", "index": 0},
                {"type": "document", "index": 1},
                {"type": "document", "index": 2},
            ]
        },
    )
    context.workbook = wb

    res = document_service.delete_document(context, 1)  # Delete D1
    assert "error" not in res

    # Check tab_order
    new_wb = context.workbook
    new_order = new_wb.metadata["tab_order"]
    # D0 should be index 0. D2 should be index 1.
    d0 = next(i for i in new_order if i["index"] == 0)
    d2 = next(i for i in new_order if i["index"] == 1)  # Was 2, now 1
    assert d0
    assert d2
    assert len(new_order) == 2

    # 5. Add document with after_workbook=True
    # Setup: # Tables (Workbook)
    md = "# Tables"
    context.md_text = md
    context.config = json.dumps({"rootMarker": "# Tables"})
    context.workbook = Workbook(sheets=[])

    res = document_service.add_document(context, "AfterWB", after_workbook=True)
    assert "# AfterWB" in context.md_text
    assert context.md_text.index("# AfterWB") > context.md_text.index("# Tables")


def test_document_service_exceptions(context):
    """Test exception handling in document service functions."""
    from unittest.mock import patch

    # Patch context.update_state to raise Exception
    with patch.object(context, "update_state", side_effect=Exception("Boom")):
        context.md_text = "# Doc"
        res = document_service.add_document(context, "Title")
        # Should return error dict, not raise
        assert "error" in res
        assert "Boom" in res["error"]

    with patch.object(context, "update_state", side_effect=Exception("Boom")):
        context.md_text = "# Doc"
        res = document_service.rename_document(context, 0, "Title")
        assert "error" in res
        assert "Boom" in res["error"]

    with patch.object(context, "update_state", side_effect=Exception("Boom")):
        context.md_text = "# Doc"
        context.workbook = Workbook(sheets=[])
        res = document_service.delete_document(context, 0)
        assert "error" in res
        assert "Boom" in res["error"]


def test_add_document_with_existing_documents_no_metadata(context):
    """Test that adding a document includes existing items in tab_order.

    Bug reproduction: When tab_order metadata doesn't exist and there are
    existing documents and sheets, adding a new document should include ALL
    existing items in the tab_order, not just sheets.

    This test simulates what bottom-tabs does: uses insert_after_tab_order_index
    to specify where in the UI order the new document should appear.
    """
    import json

    from md_spreadsheet_parser import Sheet, Table, Workbook

    # Setup: Document -> Sheet (no tab_order metadata)
    md = """# My Document

Some content here.

# Tables

## Sheet 1

### Table 1

| A | B |
|---|---|
| 1 | 2 |
"""
    context.md_text = md
    context.config = json.dumps({"rootMarker": "# Tables"})

    # Create workbook with one existing sheet but NO tab_order metadata
    existing_table = Table(headers=["A", "B"], rows=[["1", "2"]], metadata={})
    existing_sheet = Sheet(name="Sheet 1", tables=[existing_table])
    context.workbook = Workbook(sheets=[existing_sheet], metadata={})

    # Add a new document at the end (after last tab, which is sheet at position 1)
    # bottom-tabs would call: addDocument(name, afterDocIndex, afterWorkbook, insertAfterTabOrderIndex)
    # For appending: afterWorkbook=True, insertAfterTabOrderIndex=1 (after the sheet)
    document_service.add_document(
        context, "New Document", after_workbook=True, insert_after_tab_order_index=1
    )

    # Verify: tab_order should include the existing document, sheet, AND new document
    tab_order = context.workbook.metadata.get("tab_order", [])

    # The new tab_order should reflect the COMPLETE structure order
    assert len(tab_order) == 3, (
        f"Expected 3 items in tab_order, got {len(tab_order)}: {tab_order}"
    )

    # Verify the structure contains all expected types
    types_in_order = [(item["type"], item["index"]) for item in tab_order]

    # Should have: 1 existing document, 1 sheet, 1 new document
    doc_entries = [t for t in types_in_order if t[0] == "document"]
    sheet_entries = [t for t in types_in_order if t[0] == "sheet"]

    assert len(doc_entries) == 2, f"Expected 2 document entries, got {doc_entries}"
    assert len(sheet_entries) == 1, f"Expected 1 sheet entry, got {sheet_entries}"
    assert sheet_entries[0] == ("sheet", 0), "Sheet should have index 0"
