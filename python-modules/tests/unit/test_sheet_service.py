import pytest
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import sheet as sheet_service
from md_spreadsheet_parser import Sheet, Workbook


@pytest.fixture
def context():
    ctx = EditorContext()
    ctx.reset()
    return ctx


def test_add_sheet(context):
    context.workbook = Workbook(sheets=[])
    context.md_text = ""

    result = sheet_service.add_sheet(context, "New Sheet")
    assert "content" in result
    assert len(context.workbook.sheets) == 1
    assert context.workbook.sheets[0].name == "New Sheet"


def test_add_sheet_default_title(context):
    context.workbook = Workbook(sheets=[])
    context.md_text = ""
    sheet_service.add_sheet(context, "")
    assert context.workbook.sheets[0].name == "Sheet 1"


def test_add_sheet_default_title_collision(context):
    context.workbook = Workbook(sheets=[Sheet(name="Sheet 1", tables=[])])
    context.md_text = ""
    sheet_service.add_sheet(context, "")
    assert len(context.workbook.sheets) == 2
    assert context.workbook.sheets[1].name == "Sheet 2"


def test_add_sheet_with_index(context):
    s1 = Sheet(name="Sheet 1", tables=[])
    s2 = Sheet(name="Sheet 2", tables=[])
    context.workbook = Workbook(sheets=[s1, s2])
    context.md_text = ""

    # Insert between 1 and 2
    sheet_service.add_sheet(context, "Middle Sheet", after_sheet_index=1)

    assert len(context.workbook.sheets) == 3
    assert context.workbook.sheets[1].name == "Middle Sheet"


def test_rename_sheet(context):
    s1 = Sheet(name="Old Name", tables=[])
    context.workbook = Workbook(sheets=[s1])
    context.md_text = ""

    sheet_service.rename_sheet(context, 0, "New Name")
    assert context.workbook.sheets[0].name == "New Name"


def test_delete_sheet(context):
    s1 = Sheet(name="S1", tables=[])
    context.workbook = Workbook(sheets=[s1])
    context.md_text = ""

    sheet_service.delete_sheet(context, 0)
    assert len(context.workbook.sheets) == 0


def test_move_sheet(context):
    s1 = Sheet(name="A", tables=[])
    s2 = Sheet(name="B", tables=[])
    s3 = Sheet(name="C", tables=[])
    context.workbook = Workbook(sheets=[s1, s2, s3])
    context.md_text = ""

    # Move A (0) to after B (1) -> index 1
    sheet_service.move_sheet(context, 0, 1)  # A becomes at index 1

    # Expected: B, A, C
    assert context.workbook.sheets[0].name == "B"
    assert context.workbook.sheets[1].name == "A"
    assert context.workbook.sheets[2].name == "C"


def test_update_sheet_metadata(context):
    from md_spreadsheet_parser import Sheet, Workbook

    s1 = Sheet(name="S1", tables=[], metadata={"old": "val"})
    context.workbook = Workbook(sheets=[s1])
    context.md_text = ""

    new_meta = {"old": "val", "new": "data"}
    # Call service
    try:
        sheet_service.update_sheet_metadata(context, 0, new_meta)
    except AttributeError:
        pytest.fail("update_sheet_metadata not implemented")

    assert context.workbook.sheets[0].metadata == new_meta


def test_add_sheet_with_existing_documents_no_metadata(context):
    """Test that adding a sheet includes existing documents in tab_order.

    Bug reproduction: When tab_order metadata doesn't exist and there are
    existing documents, adding a new sheet should include both the existing
    documents AND sheets in the tab_order, not just sheets.
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

    # Add a new sheet (this is what bottom-tabs + button does)
    sheet_service.add_sheet(context, "New Sheet")

    # Verify: tab_order should include both the document AND sheets
    # Expected order based on structure: document(0), sheet(0), sheet(1)
    tab_order = context.workbook.metadata.get("tab_order", [])

    # The new tab_order should reflect the COMPLETE structure order
    # Document comes first (index 0), then existing sheet (index 0), then new sheet (index 1)
    assert len(tab_order) == 3, (
        f"Expected 3 items in tab_order, got {len(tab_order)}: {tab_order}"
    )

    # First item should be document
    assert tab_order[0] == {"type": "document", "index": 0}, (
        f"Expected document at position 0, got {tab_order[0]}"
    )
    # Second item should be existing sheet
    assert tab_order[1] == {"type": "sheet", "index": 0}, (
        f"Expected sheet 0 at position 1, got {tab_order[1]}"
    )
    # Third item should be new sheet (appended at end)
    assert tab_order[2] == {"type": "sheet", "index": 1}, (
        f"Expected sheet 1 at position 2, got {tab_order[2]}"
    )
