import headless_editor
import pytest


@pytest.fixture
def test_data():
    headless_editor.workbook = None
    # Initialize schema to avoid AssertionError in generate_and_get_range
    headless_editor.schema = headless_editor.MultiTableParsingSchema()

    headless_editor.add_sheet("Sheet 1", ["A", "B", "C"])
    # Add some rows
    headless_editor.update_cell(0, 0, 0, 0, "R1C1")
    headless_editor.update_cell(0, 0, 0, 1, "R1C2")
    headless_editor.update_cell(0, 0, 0, 2, "R1C3")

    headless_editor.update_cell(0, 0, 1, 0, "R2C1")
    headless_editor.update_cell(0, 0, 1, 1, "R2C2")
    headless_editor.update_cell(0, 0, 1, 2, "R2C3")

    headless_editor.update_cell(0, 0, 2, 0, "R3C1")
    headless_editor.update_cell(0, 0, 2, 1, "R3C2")
    headless_editor.update_cell(0, 0, 2, 2, "R3C3")

    headless_editor.update_cell(0, 0, 3, 0, "R4C1")
    headless_editor.update_cell(0, 0, 3, 1, "R4C2")
    headless_editor.update_cell(0, 0, 3, 2, "R4C3")

    # Rows:
    # 0: R1C1, R1C2, R1C3
    # 1: R2C1, R2C2, R2C3
    # 2: R3C1, R3C2, R3C3
    # 3: R4C1, R4C2, R4C3
    return headless_editor.workbook


def test_move_single_row_down(test_data):
    # Move Row 0 (R1) to Index 2 (After R2, Before R3) => Index 2?
    # Target index interpretation: "Insert before this index"
    # Wait, simple list insert behavior:
    # If I have [A, B, C, D] and move A (0) to 2:
    # pop 0 -> [B, C, D]
    # insert at 2 -> [B, C, A, D]

    # Let's define semantic: target_index is the index BEFORE which the rows will be placed
    # AFTER the rows are removed (if we do remove-then-insert strategy).
    # OR target_index is the visual index where the user dropped it.

    # Let's assume standard behavior:
    # move_rows(sheet_idx, table_idx, row_indices=[0], target_index=2)
    # R1 moves between R2 and R3.
    # Expected: R2, R1, R3, R4

    result = headless_editor.move_rows(0, 0, [0], 2)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    assert rows[0][0] == "R2C1"
    assert rows[1][0] == "R1C1"  # Moved here
    assert rows[2][0] == "R3C1"
    assert rows[3][0] == "R4C1"


def test_move_single_row_up(test_data):
    # Move Row 2 (R3) to Index 0 (Top)
    # [R1, R2, R3, R4] -> [R3, R1, R2, R4]

    result = headless_editor.move_rows(0, 0, [2], 0)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    assert rows[0][0] == "R3C1"  # Moved here
    assert rows[1][0] == "R1C1"
    assert rows[2][0] == "R2C1"
    assert rows[3][0] == "R4C1"


def test_move_multiple_contiguous_rows(test_data):
    # Move R1, R2 (0, 1) to End (Index 4)
    # [R1, R2, R3, R4] -> [R3, R4, R1, R2]

    result = headless_editor.move_rows(0, 0, [0, 1], 4)
    assert "error" not in result

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    assert len(rows) == 4
    assert rows[0][0] == "R3C1"
    assert rows[1][0] == "R4C1"
    assert rows[2][0] == "R1C1"
    assert rows[3][0] == "R2C1"


def test_move_multiple_non_contiguous_rows(test_data):
    # Move R1 (0) and R3 (2) to Index 1 (After what becomes 0?)
    # This is tricky.
    # Current: [R1, R2, R3, R4]
    # Selected: R1, R3
    # Target: 1 (Between R1 and R2 originally? Or relative to new list?)

    # Relative to dragging UI, usually you drop "between rows".
    # If I drop "between R2 and R4":
    # Remaining: [R2, R4]
    # Dropped: [R1, R3]
    # Target in remaining list [R2, R4] is index 1.
    # Result: [R2, R1, R3, R4]

    # So the logic should be:
    # 1. Extract selected rows (in original order).
    # 2. Remove them from original list.
    # 3. Calculate effective insertion point in the *remaining* list.

    # Test Case: target index 1 (between R2 and R4 in remaining [R2, R4])
    # Expected: [R2, R1, R3, R4]

    # NOTE: The caller (frontend) must calculate the target index relative to the *visual* state
    # OR we handle "if target_index was shifted".
    # Ideally, frontend says "Drop BEFORE Row X".
    # If Row X is one of the moving rows, that's a no-op or specific behavior.
    # If Row X is not moving, we find its index in the remaining list and insert there.

    # Let's assume the API expects "insert before row at current index X".
    # But if index X shifts?
    # Best approach: "Insert at index X" implies final index X? No.

    # Adopted Logic:
    # 1. Get objects to move.
    # 2. Delete them.
    # 3. Insert them at `target_index`.
    # BUT `target_index` needs to be adjusted if we deleted rows *before* it.

    # Example: Move 0 and 2 to 4.
    # Deleting 0: [R2, R3, R4] (target 4 -> 3)
    # Deleting 2 (now 1): [R2, R4] (target 3 -> 2)
    # Remaining: [R2, R4]. Target is 2 (End).
    # Insert [R1, R3] at 2. -> [R2, R4, R1, R3]

    # Example: Move 0 and 2 to 1 (between R1 and R2 - wait, R1 is moving).
    # If I drag R1 and R3 and drop before R2.
    # Target is 1 (R2's index).
    # Remove R1, R3. Remaining: [R2, R4].
    # Target 1 (R2) was at 1. Did we remove anything before R2? Yes, R0.
    # So R2 shifts to 0.
    # Effective target in remaining list is 0.
    # Result: [R1, R3, R2, R4].

    # Implementation should handle this "adjustment".

    result = headless_editor.move_rows(0, 0, [0, 2], 1)

    wb = headless_editor.workbook
    table = wb.sheets[0].tables[0]
    rows = table.rows

    # Original: [R1, R2, R3, R4]
    # Move R1, R3 to before R2 (Index 1)
    # Expect: [R1, R3, R2, R4]

    assert rows[0][0] == "R1C1"
    assert rows[1][0] == "R3C1"
    assert rows[2][0] == "R2C1"
    assert rows[3][0] == "R4C1"
