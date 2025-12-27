"""Tests for move operations: move_rows, move_columns, move_cells."""

import os
import sys

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from md_spreadsheet_parser import Workbook
from md_spreadsheet_parser.models import Sheet, Table


def setup_test_workbook():
    """Create a test workbook with a 3x3 table."""
    sheet = Sheet(
        name="Sheet1",
        tables=[
            Table(
                name="Table1",
                headers=["A", "B", "C"],
                rows=[
                    ["A1", "B1", "C1"],
                    ["A2", "B2", "C2"],
                    ["A3", "B3", "C3"],
                ],
                metadata={},
            )
        ],
    )
    return Workbook(sheets=[sheet])


class TestMoveRows:
    """Tests for move_rows function."""

    def test_move_single_row_down(self):
        """Move row 0 to position 2 (after row 1)."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move row 0 to position 2
            # Before: [A1,B1,C1], [A2,B2,C2], [A3,B3,C3]
            # After:  [A2,B2,C2], [A3,B3,C3], [A1,B1,C1]
            headless_editor.move_rows(0, 0, [0], 3)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0] == ["A2", "B2", "C2"]
            assert rows[1] == ["A3", "B3", "C3"]
            assert rows[2] == ["A1", "B1", "C1"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_single_row_up(self):
        """Move row 2 to position 0."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move row 2 to position 0
            # Before: [A1,B1,C1], [A2,B2,C2], [A3,B3,C3]
            # After:  [A3,B3,C3], [A1,B1,C1], [A2,B2,C2]
            headless_editor.move_rows(0, 0, [2], 0)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0] == ["A3", "B3", "C3"]
            assert rows[1] == ["A1", "B1", "C1"]
            assert rows[2] == ["A2", "B2", "C2"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_multiple_rows(self):
        """Move rows 0 and 1 to position 3 (end)."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move rows 0,1 to end
            # Before: [A1,B1,C1], [A2,B2,C2], [A3,B3,C3]
            # After:  [A3,B3,C3], [A1,B1,C1], [A2,B2,C2]
            headless_editor.move_rows(0, 0, [0, 1], 3)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0] == ["A3", "B3", "C3"]
            assert rows[1] == ["A1", "B1", "C1"]
            assert rows[2] == ["A2", "B2", "C2"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_row_same_position(self):
        """Move row to same position should be no-op."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move row 1 to position 1 (no change)
            headless_editor.move_rows(0, 0, [1], 1)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0] == ["A1", "B1", "C1"]
            assert rows[1] == ["A2", "B2", "C2"]
            assert rows[2] == ["A3", "B3", "C3"]
        finally:
            headless_editor.generate_and_get_range = original_gen


class TestMoveColumns:
    """Tests for move_columns function."""

    def test_move_single_column_right(self):
        """Move column 0 (A) to position 3 (end)."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Before: A, B, C
            # After:  B, C, A
            headless_editor.move_columns(0, 0, [0], 3)

            wb = headless_editor.workbook
            headers = wb.sheets[0].tables[0].headers
            rows = wb.sheets[0].tables[0].rows

            assert headers == ["B", "C", "A"]
            assert rows[0] == ["B1", "C1", "A1"]
            assert rows[1] == ["B2", "C2", "A2"]
            assert rows[2] == ["B3", "C3", "A3"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_single_column_left(self):
        """Move column 2 (C) to position 0."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Before: A, B, C
            # After:  C, A, B
            headless_editor.move_columns(0, 0, [2], 0)

            wb = headless_editor.workbook
            headers = wb.sheets[0].tables[0].headers
            rows = wb.sheets[0].tables[0].rows

            assert headers == ["C", "A", "B"]
            assert rows[0] == ["C1", "A1", "B1"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_multiple_columns(self):
        """Move columns 0 and 1 to end."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Before: A, B, C
            # After:  C, A, B
            headless_editor.move_columns(0, 0, [0, 1], 3)

            wb = headless_editor.workbook
            headers = wb.sheets[0].tables[0].headers
            rows = wb.sheets[0].tables[0].rows

            assert headers == ["C", "A", "B"]
            assert rows[0] == ["C1", "A1", "B1"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_column_preserves_metadata(self):
        """Move column should shift column metadata appropriately."""
        import headless_editor

        sheet = Sheet(
            name="Sheet1",
            tables=[
                Table(
                    name="Table1",
                    headers=["A", "B", "C"],
                    rows=[["1", "2", "3"]],
                    metadata={"columnWidths": {"0": 100, "1": 150, "2": 200}},
                )
            ],
        )
        headless_editor.workbook = Workbook(sheets=[sheet])
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move col 0 (width 100) to position 3 (end)
            # Before widths: 0->100, 1->150, 2->200
            # After widths:  0->150, 1->200, 2->100
            headless_editor.move_columns(0, 0, [0], 3)

            metadata = headless_editor.workbook.sheets[0].tables[0].metadata
            widths = metadata.get("columnWidths", {})

            assert widths.get("0") == 150
            assert widths.get("1") == 200
            assert widths.get("2") == 100
        finally:
            headless_editor.generate_and_get_range = original_gen


class TestMoveCells:
    """Tests for move_cells function."""

    def test_move_single_cell(self):
        """Move a single cell to a new position."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move cell at (0,0) "A1" to (2,2)
            # Source (0,0) should become empty
            # Target (2,2) which was "C3" should become "A1"
            src_range = {"minR": 0, "maxR": 0, "minC": 0, "maxC": 0}
            headless_editor.move_cells(0, 0, src_range, 2, 2)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0][0] == ""  # Source cleared
            assert rows[2][2] == "A1"  # Target overwritten
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_cell_range(self):
        """Move a 2x2 range to a new position."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move 2x2 range at (0,0)-(1,1) to starting at (1,1)
            # This moves: A1,B1,A2,B2 to overwrite B2,C2,B3,C3
            src_range = {"minR": 0, "maxR": 1, "minC": 0, "maxC": 1}
            headless_editor.move_cells(0, 0, src_range, 1, 1)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            # Source cleared
            assert rows[0][0] == ""
            assert rows[0][1] == ""
            assert rows[1][0] == ""
            # Target overwritten
            assert rows[1][1] == "A1"
            assert rows[1][2] == "B1"
            assert rows[2][1] == "A2"
            assert rows[2][2] == "B2"
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_cells_overlapping(self):
        """Move cells to overlapping position - source should be partially cleared."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            # Move range (0,0)-(0,1) "A1,B1" to (0,1) "B1,C1"
            # Result: row 0 should be: "", "A1", "B1"
            src_range = {"minR": 0, "maxR": 0, "minC": 0, "maxC": 1}
            headless_editor.move_cells(0, 0, src_range, 0, 1)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0] == ["", "A1", "B1"]
        finally:
            headless_editor.generate_and_get_range = original_gen

    def test_move_cells_same_position_noop(self):
        """Move cells to same position should not change anything."""
        import headless_editor

        headless_editor.workbook = setup_test_workbook()
        original_gen = headless_editor.generate_and_get_range
        headless_editor.generate_and_get_range = lambda: {"success": True}

        try:
            src_range = {"minR": 0, "maxR": 0, "minC": 0, "maxC": 0}
            headless_editor.move_cells(0, 0, src_range, 0, 0)

            rows = headless_editor.workbook.sheets[0].tables[0].rows
            assert rows[0][0] == "A1"  # Unchanged
        finally:
            headless_editor.generate_and_get_range = original_gen
