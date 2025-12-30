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
