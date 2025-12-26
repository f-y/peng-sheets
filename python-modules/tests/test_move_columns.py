import headless_editor
import pytest


@pytest.fixture
def test_data():
    headless_editor.workbook = None
    headless_editor.schema = headless_editor.MultiTableParsingSchema()

    headless_editor.add_sheet("Sheet 1", ["Col A", "Col B", "Col C", "Col D"])

    headless_editor.update_cell(0, 0, 0, 0, "A1")
    headless_editor.update_cell(0, 0, 0, 1, "B1")
    headless_editor.update_cell(0, 0, 0, 2, "C1")
    headless_editor.update_cell(0, 0, 0, 3, "D1")

    # Set Metadata for Col B (Index 1) and Col D (Index 3)
    # Visual: widths, validation
    visual_meta = {
        "column_widths": {
            "1": 50,  # Col B
            "3": 100,  # Col D
        },
        "validation": {
            "1": {"type": "list", "values": ["x", "y"]},
            "2": {"type": "int"},  # Col C
        },
    }
    headless_editor.update_visual_metadata(0, 0, visual_meta)

    return headless_editor.workbook


def test_move_single_column_right(test_data):
    # Move Col A (0) to Index 2 (After B, Before C)
    # [A, B, C, D] -> [B, A, C, D]
    # target_index 2 implies insertion at index 2 in the *remaining* list [B, C, D]?
    # Remaining: [B, C, D]. Index 0=B, 1=C, 2=D?
    # No, typically insert at index i means "become the new index i".
    # Remaining: [B, C, D]. Insert at 1 -> [B, A, C, D].

    # Let's stick to the same logic as rows:
    # 1. Remove indices.
    # 2. Adjust target index.
    # 3. Insert.

    # Move 0 to 2.
    # Remove 0. [B, C, D].
    # Target 2. Removed before target (0 < 2) = 1.
    # Adjusted target = 2 - 1 = 1.
    # Insert at 1. [B, A, C, D]. Correct.

    result = headless_editor.move_columns(0, 0, [0], 2)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    headers = table.headers
    assert headers == ["Col B", "Col A", "Col C", "Col D"]

    # Check data row
    row = table.rows[0]
    assert row == ["B1", "A1", "C1", "D1"]


def test_move_column_with_metadata(test_data):
    # Move Col B (Index 1) to End (Index 4)
    # Original: [A, B, C, D]
    # B has width 50, validation list.
    # C has validation int.
    # D has width 100.

    # Result: [A, C, D, B]
    # Indices: 0->A, 1->C, 2->D, 3->B

    # Metadata Check:
    # Old 1 (B) -> New 3. (Width 50, Val list)
    # Old 2 (C) -> New 1. (Val int)
    # Old 3 (D) -> New 2. (Width 100)

    result = headless_editor.move_columns(0, 0, [1], 4)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    headers = table.headers
    assert headers == ["Col A", "Col C", "Col D", "Col B"]

    visual = table.metadata["visual"]
    widths = visual.get("column_widths", {})
    validation = visual.get("validation", {})

    # Check B (New 3)
    assert str(3) in widths
    assert widths[str(3)] == 50
    assert str(3) in validation
    assert validation[str(3)]["type"] == "list"

    # Check C (New 1) - shifted from 2
    assert str(1) in validation
    assert validation[str(1)]["type"] == "int"

    # Check D (New 2) - shifted from 3
    assert str(2) in widths
    assert widths[str(2)] == 100


def test_move_multiple_columns(test_data):
    # Move B (1) and D (3) to 0 (Beginning)
    # Original: [A, B, C, D]
    # Result: [B, D, A, C]

    result = headless_editor.move_columns(0, 0, [1, 3], 0)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    headers = table.headers
    assert headers == ["Col B", "Col D", "Col A", "Col C"]

    # Check Metadata
    visual = table.metadata["visual"]
    widths = visual.get("column_widths", {})

    # B (New 0) -> Width 50
    assert widths[str(0)] == 50
    # D (New 1) -> Width 100
    assert widths[str(1)] == 100
