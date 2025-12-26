import headless_editor
import pytest


@pytest.fixture
def test_data():
    headless_editor.workbook = None
    headless_editor.schema = headless_editor.MultiTableParsingSchema()

    headless_editor.add_sheet("Sheet 1", ["A", "B", "C"])

    # 3x3 Grid
    headless_editor.update_cell(0, 0, 0, 0, "A1")
    headless_editor.update_cell(0, 0, 0, 1, "B1")
    headless_editor.update_cell(0, 0, 0, 2, "C1")

    headless_editor.update_cell(0, 0, 1, 0, "A2")
    headless_editor.update_cell(0, 0, 1, 1, "B2")
    headless_editor.update_cell(0, 0, 1, 2, "C2")

    headless_editor.update_cell(0, 0, 2, 0, "A3")
    headless_editor.update_cell(0, 0, 2, 1, "B3")
    headless_editor.update_cell(0, 0, 2, 2, "C3")

    return headless_editor.workbook


def test_move_cells_disjoint(test_data):
    # Move A1:B1 (0,0 to 0,1) to A4:B4 (3,0)
    # Source: (0,0) - (0,1)
    # Target: (3,0)

    # Selection Range expected format: dict or object?
    # headless_editor python function usually takes primitive args.
    # Let's pass min_r, max_r, min_c, max_c

    result = headless_editor.move_cells(0, 0, 0, 0, 0, 1, 3, 0)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    # Check Source Cleared
    assert rows[0][0] == ""  # A1
    assert rows[0][1] == ""  # B1
    assert rows[0][2] == "C1"  # Unchanged

    # Check Target Populated (Rows expanded)
    assert len(rows) >= 4
    assert rows[3][0] == "A1"
    assert rows[3][1] == "B1"


def test_move_cells_overlap_down(test_data):
    # Move A1:A2 to A2:A3
    # Source: (0,0)-(1,0) i.e. A1, A2
    # Target: (1,0) i.e. A2

    # Expected:
    # A1 -> ""
    # A2 -> A1 ("A1")
    # A3 -> A2 ("A2")

    result = headless_editor.move_cells(0, 0, 0, 1, 0, 0, 1, 0)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    assert rows[0][0] == ""  # Old A1
    assert rows[1][0] == "A1"  # New A2
    assert rows[2][0] == "A2"  # New A3

    # B column unchanged
    assert rows[0][1] == "B1"
    assert rows[1][1] == "B2"


def test_move_cells_overlap_up(test_data):
    # Move A2:A3 to A1:A2
    # Source: (1,0)-(2,0)
    # Target: (0,0)

    # Expected:
    # A1 -> A2 ("A2")
    # A2 -> A3 ("A3")
    # A3 -> ""

    result = headless_editor.move_cells(0, 0, 1, 2, 0, 0, 0, 0)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    assert rows[0][0] == "A2"
    assert rows[1][0] == "A3"
    assert rows[2][0] == ""
