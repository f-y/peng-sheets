"""Debug test to trace through the exact scenario reported by user."""

import json

import pytest
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import document as document_service
from md_spreadsheet_parser import MultiTableParsingSchema, Sheet, Table, Workbook


@pytest.fixture
def context():
    ctx = EditorContext()
    ctx.reset()
    ctx.update_state(schema=MultiTableParsingSchema())
    return ctx


def test_add_document_real_scenario(context):
    """
    Exact reproduction of user's scenario:
    - Original file has: Document (# Markdown Spreadsheet Overview) -> Workbook (# Tables) -> Sheet 1
    - User selects Sheet 1 and adds a Document
    - Expected tab_order: document(0), sheet(0), document(1)
    - Actual bug: document(0) is missing
    """
    # Original markdown (simplified version of user's file)
    original_md = """# Markdown Spreadsheet Overview

This document is a hybrid notebook.

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |
"""

    context.md_text = original_md
    context.config = json.dumps({"rootMarker": "# Tables"})

    # Create workbook with one existing sheet but NO tab_order metadata
    existing_table = Table(
        headers=["Column 1", "Column 2", "Column 3"], rows=[["", "", ""]], metadata={}
    )
    existing_sheet = Sheet(name="Sheet 1", tables=[existing_table])
    context.workbook = Workbook(sheets=[existing_sheet], metadata={})

    # Debug: Print what initialize_tab_order_from_structure returns
    from md_spreadsheet_editor.services.workbook import (
        initialize_tab_order_from_structure,
    )

    initial_order = initialize_tab_order_from_structure(
        context.md_text, context.config, len(context.workbook.sheets)
    )
    print(f"\nDEBUG: initialize_tab_order_from_structure returned: {initial_order}")

    # Add a new document at the end (after Sheet 1, which is at tab position 1)
    # This simulates: user selected Sheet 1 (position 1), clicked "Add Document"
    result = document_service.add_document(
        context,
        "Document 2",
        after_workbook=True,
        insert_after_tab_order_index=1,  # After Sheet 1
    )

    print(f"DEBUG: add_document result: {result}")
    print(f"DEBUG: workbook.metadata: {context.workbook.metadata}")

    # Verify: tab_order should include document(0), sheet(0), document(1)
    tab_order = context.workbook.metadata.get("tab_order", [])
    print(f"DEBUG: Final tab_order: {tab_order}")

    # Check that document(0) is present
    doc_0 = {"type": "document", "index": 0}
    assert doc_0 in tab_order, f"document(0) should be in tab_order: {tab_order}"

    # Check total count
    assert len(tab_order) == 3, f"Expected 3 items, got {len(tab_order)}: {tab_order}"


def test_add_document_full_update_flow(context):
    """
    Test the FULL production flow using add_document_and_get_full_update.
    This is what the TypeScript frontend actually calls.
    """
    # Original markdown
    original_md = """# Markdown Spreadsheet Overview

This document is a hybrid notebook.

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |
"""

    context.md_text = original_md
    context.config = json.dumps({"rootMarker": "# Tables"})

    # Create workbook with one existing sheet but NO tab_order metadata
    existing_table = Table(
        headers=["Column 1", "Column 2", "Column 3"], rows=[["", "", ""]], metadata={}
    )
    existing_sheet = Sheet(name="Sheet 1", tables=[existing_table])
    context.workbook = Workbook(sheets=[existing_sheet], metadata={})

    # Use the full update function that production uses
    document_service.add_document_and_get_full_update(
        context, "Document 2", after_workbook=True, insert_after_tab_order_index=1
    )

    print(f"\nDEBUG (full_update): workbook.metadata: {context.workbook.metadata}")

    # Check the tab_order
    tab_order = context.workbook.metadata.get("tab_order", [])
    print(f"DEBUG (full_update): Final tab_order: {tab_order}")

    # Assert document(0) exists
    doc_0 = {"type": "document", "index": 0}
    assert doc_0 in tab_order, f"document(0) should be in tab_order: {tab_order}"

    assert len(tab_order) == 3, f"Expected 3 items, got {len(tab_order)}: {tab_order}"


def test_add_document_typescript_flow_with_existing_doc(context):
    """
    Test the exact flow when TypeScript _addDocument is called and a document already exists.

    In TypeScript:
    - docTabs.length > 0 (there IS an existing document)
    - afterDocIndex = Math.max(...docTabs.map(t => t.docIndex!)) = 0
    - afterWorkbook = false
    - insertAfterTabOrderIndex = validTabs.length - 1 = 1 (doc at 0, sheet at 1)
    """
    # Original markdown
    original_md = """# Markdown Spreadsheet Overview

This document is a hybrid notebook.

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |
"""

    context.md_text = original_md
    context.config = json.dumps({"rootMarker": "# Tables"})

    # Create workbook with one existing sheet but NO tab_order metadata
    existing_table = Table(
        headers=["Column 1", "Column 2", "Column 3"], rows=[["", "", ""]], metadata={}
    )
    existing_sheet = Sheet(name="Sheet 1", tables=[existing_table])
    context.workbook = Workbook(sheets=[existing_sheet], metadata={})

    # TypeScript flow when docTabs.length > 0:
    # afterDocIndex = 0 (there's one document with docIndex 0)
    # afterWorkbook = False (not used because afterDocIndex >= 0)
    # insertAfterTabOrderIndex = 1 (after Sheet 1)
    document_service.add_document_and_get_full_update(
        context,
        "Document 2",
        after_doc_index=0,  # After the existing document
        after_workbook=False,
        insert_after_tab_order_index=1,
    )

    print(f"\nDEBUG (ts_flow): workbook.metadata: {context.workbook.metadata}")

    # Check the tab_order
    tab_order = context.workbook.metadata.get("tab_order", [])
    print(f"DEBUG (ts_flow): Final tab_order: {tab_order}")

    # Assert document(0) exists (the original document)
    doc_0 = {"type": "document", "index": 0}
    assert doc_0 in tab_order, f"document(0) should be in tab_order: {tab_order}"

    # Should have 3 items: document(0), sheet(0), document(1)
    assert len(tab_order) == 3, f"Expected 3 items, got {len(tab_order)}: {tab_order}"


def test_add_sheet_typescript_flow_with_existing_doc(context):
    """
    Test the exact flow when TypeScript _addSheet is called and a document already exists.
    This reproduces the bug where document(0) is missing from tab_order after adding a sheet.

    TypeScript _addSheet logic:
    - validTabs = [doc, sheet] -> length = 2
    - targetTabOrderIndex = validTabs.length = 2 (append at end)
    - sheetCount = 1 (existing sheets)
    - afterSheetIndex = sheetCount - 1 = 0 (append after last sheet)
    """
    from md_spreadsheet_editor.services import sheet as sheet_service

    # Original markdown
    original_md = """# Markdown Spreadsheet Overview

This document is a hybrid notebook.

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |
"""

    context.md_text = original_md
    context.config = json.dumps({"rootMarker": "# Tables"})

    # Create workbook with one existing sheet but NO tab_order metadata
    existing_table = Table(
        headers=["Column 1", "Column 2", "Column 3"], rows=[["", "", ""]], metadata={}
    )
    existing_sheet = Sheet(name="Sheet 1", tables=[existing_table])
    context.workbook = Workbook(sheets=[existing_sheet], metadata={})

    # TypeScript _addSheet flow:
    # afterSheetIndex = sheetCount - 1 = 0 (append after last sheet)
    # But in main.ts _addSheet: afterSheetIndex = sheetCount = 1, not sheetCount - 1!
    # Let me check main.ts again...

    # From main.ts line 989-990:
    # const sheetCount = this.workbook?.sheets?.length ?? 0;
    # const afterSheetIndex = sheetCount - 1; // Append after last sheet

    print(
        f"\nDEBUG (add_sheet): Before add_sheet, workbook.metadata: {context.workbook.metadata}"
    )

    # Call add_sheet (not the full update version, just to check tab_order)
    sheet_service.add_sheet(
        context,
        "Sheet 2",
        after_sheet_index=None,  # Append at end (default behavior)
        target_tab_order_index=2,  # After doc(0) at 0, sheet(0) at 1
    )

    print(
        f"DEBUG (add_sheet): After add_sheet, workbook.metadata: {context.workbook.metadata}"
    )

    # Check the tab_order
    tab_order = context.workbook.metadata.get("tab_order", [])
    print(f"DEBUG (add_sheet): Final tab_order: {tab_order}")

    # Assert document(0) exists (the original document)
    doc_0 = {"type": "document", "index": 0}
    assert doc_0 in tab_order, f"document(0) should be in tab_order: {tab_order}"

    # Should have 3 items: document(0), sheet(0), sheet(1)
    assert len(tab_order) == 3, f"Expected 3 items, got {len(tab_order)}: {tab_order}"


def test_add_sheet_typescript_flow_with_after_sheet_index_0(context):
    """
    Test the exact flow when TypeScript _addSheet is called and a document already exists,
    and after_sheet_index is explicitly 0 (as it would be if sheetCount=1 and afterSheetIndex = sheetCount - 1).
    This tests the problematic TypeScript logic, but Python should still
    initialize tab_order properly even in this case.
    """
    from md_spreadsheet_editor.services import sheet as sheet_service

    # Original markdown
    original_md = """# Markdown Spreadsheet Overview

This document is a hybrid notebook.

# Tables

## Sheet 1

| Column 1 | Column 2 | Column 3 |
| --- | --- | --- |
|  |  |  |
"""

    context.md_text = original_md
    context.config = json.dumps({"rootMarker": "# Tables"})

    # Create workbook with one existing sheet but NO tab_order metadata
    existing_table = Table(
        headers=["Column 1", "Column 2", "Column 3"], rows=[["", "", ""]], metadata={}
    )
    existing_sheet = Sheet(name="Sheet 1", tables=[existing_table])
    context.workbook = Workbook(sheets=[existing_sheet], metadata={})

    print(
        f"\nDEBUG (add_sheet): Before add_sheet, workbook.metadata: {context.workbook.metadata}"
    )

    # TypeScript _addSheet sends: afterSheetIndex = sheetCount - 1 = 0
    # This means "insert at position 0", which is BEFORE Sheet 1!
    # This is the problematic TypeScript logic, but Python should still
    # initialize tab_order properly even in this case.
    sheet_service.add_sheet(
        context,
        "Sheet 2",
        after_sheet_index=0,  # TypeScript sends sheetCount - 1 = 0
        target_tab_order_index=2,  # After doc(0) at 0, sheet(0) at 1
    )

    print(
        f"DEBUG (add_sheet): After add_sheet, workbook.metadata: {context.workbook.metadata}"
    )

    # Check the tab_order
    tab_order = context.workbook.metadata.get("tab_order", [])
    print(f"DEBUG (add_sheet): Final tab_order: {tab_order}")

    # Assert document(0) exists (the original document)
    doc_0 = {"type": "document", "index": 0}
    assert doc_0 in tab_order, f"document(0) should be in tab_order: {tab_order}"

    # Should have 3 items
    assert len(tab_order) == 3, f"Expected 3 items, got {len(tab_order)}: {tab_order}"


if __name__ == "__main__":
    ctx = EditorContext()
    ctx.reset()
    ctx.update_state(schema=MultiTableParsingSchema())
    test_add_document_real_scenario(ctx)
