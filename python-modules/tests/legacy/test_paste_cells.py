import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from md_spreadsheet_parser import Workbook
from md_spreadsheet_parser.models import Sheet, Table


def test_paste_cells_simple():
    # Setup
    initial_sheet = Sheet(
        name="Sheet1",
        tables=[
            Table(
                name="Table1",
                headers=["A", "B", "C"],
                rows=[["1", "2", "3"]],
                metadata={},
            )
        ],
    )
    # Mock global workbook (though headless_editor manages it, helper tests usually bypass or mock)
    # Actually headless_editor functions operate on 'dataset' but rely on apply_* helpers and global workbook.
    # We should use apply logic properly.

    # We need to set the global workbook in headless_editor for the test to work if we use paste_cells directly
    # OR we can mock the global 'workbook' variable in headless_editor relative to this test?
    # headless_editor.py uses `global workbook`.

    import headless_editor

    headless_editor.workbook = Workbook(sheets=[initial_sheet])
    headless_editor.schema = None  # Not needed for pure transform test logic usually, unless generating output.

    # Use paste_cells (sheet 0, table 0, start 0, 0, data)
    # Paste "New" "Data" at (0, 0)
    # Should replace "1" "2"

    # headless_editor.paste_cells returns a dict with "startLine" etc, because it calls generate_and_get_range.
    # This requires md_text and schema to be set up to generate valid ranges.
    # For unit testing logic, we might just want to inspect the workbook state?

    # Let's mock generate_and_get_range or just inspect workbook after call?
    # paste_cells calls get_state() equivalent? No, it calls generate_and_get_range().

    # To test logic without full MD generation overhead/mocking:
    # We can inspect `headless_editor.workbook` after the call if we mock generate_and_get_range to return a dummy.

    original_gen = headless_editor.generate_and_get_range
    headless_editor.generate_and_get_range = lambda: {"success": True}

    try:
        new_data = [["X", "Y"]]
        headless_editor.paste_cells(0, 0, 0, 0, new_data)

        wb = headless_editor.workbook
        rows = wb.sheets[0].tables[0].rows
        assert rows[0][0] == "X"
        assert rows[0][1] == "Y"
        assert rows[0][2] == "3"  # Unchanged
    finally:
        headless_editor.generate_and_get_range = original_gen


def test_paste_expand_rows():
    import headless_editor

    initial_sheet = Sheet(
        name="Sheet1",
        tables=[Table(name="T1", headers=["A"], rows=[["1"]], metadata={})],
    )
    headless_editor.workbook = Workbook(sheets=[initial_sheet])

    original_gen = headless_editor.generate_and_get_range
    headless_editor.generate_and_get_range = lambda: {"success": True}

    try:
        # Paste at row 2 (index 2) -> should expand (add empty row 1, then paste at 2)
        # 0: ["1"]
        # 1: [""] (created)
        # 2: ["New"] (pasted)

        new_data = [["New"]]
        headless_editor.paste_cells(0, 0, 2, 0, new_data)

        rows = headless_editor.workbook.sheets[0].tables[0].rows
        assert len(rows) == 3
        assert rows[0] == ["1"]
        assert rows[1] == [""]
        assert rows[2] == ["New"]

    finally:
        headless_editor.generate_and_get_range = original_gen


def test_paste_expand_cols():
    import headless_editor

    initial_sheet = Sheet(
        name="Sheet1",
        tables=[Table(name="T1", headers=["A"], rows=[["1"]], metadata={})],
    )
    headless_editor.workbook = Workbook(sheets=[initial_sheet])

    original_gen = headless_editor.generate_and_get_range
    headless_editor.generate_and_get_range = lambda: {"success": True}

    try:
        # Paste at col 2 -> should expand
        # 0: ["1", "", "New"]

        new_data = [["New"]]
        headless_editor.paste_cells(0, 0, 0, 2, new_data)

        rows = headless_editor.workbook.sheets[0].tables[0].rows
        headers = headless_editor.workbook.sheets[0].tables[0].headers

        assert len(rows[0]) == 3
        assert rows[0][0] == "1"
        assert rows[0][1] == ""
        assert rows[0][2] == "New"

        # Headers should expand too
        assert len(headers) == 3
        assert headers[0] == "A"
        assert headers[1].startswith("Col")

    finally:
        headless_editor.generate_and_get_range = original_gen
