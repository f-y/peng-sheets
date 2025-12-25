"""
Tests for error handling in headless_editor APIs.
"""

import headless_editor
from headless_editor import (
    delete_column,
    delete_sheet,
    initialize_workbook,
    insert_column,
    move_sheet,
    rename_sheet,
)


class TestErrorHandling:
    def setup_method(self):
        # Reset global state manually
        headless_editor.workbook = None
        headless_editor.md_text = ""
        headless_editor.schema = None
        headless_editor.config = ""

    def test_api_calls_without_workbook_return_error(self):
        """Most APIs should return error if no workbook is initialized."""
        # Don't call initialize_workbook

        assert "error" in insert_column(0, 0, 0)
        assert "error" in delete_column(0, 0, 0)
        # move_column_in_table might not return dict? Wrapper?
        # It calls apply_table_update -> apply_sheet_update -> apply_workbook_update -> checks workbook is None

    def test_invalid_indices_return_error(self):
        """APIs should return error or raise exception caught by wrapper for invalid indices."""
        md = "# Tables\n## Sheet1\n| A |"
        initialize_workbook(md, "{}")

        # Invalid sheet
        assert "error" in insert_column(99, 0, 0)

        # Invalid table (sheet exists)
        assert "error" in insert_column(0, 99, 0)

        # Invalid column index handling usually inside logic, might not raise error but do nothing?
        # Or raise IndexError caught by wrapper.

        # Delete invalid column - might be no-op
        assert "error" not in delete_column(0, 0, 99)

        # Rename invalid sheet
        # rename_sheet doesn't use apply_workbook_update wrapper same way?
        # rename_sheet -> apply_sheet_update? No.
        # It uses direct workbook manipulation often.
        assert "error" in rename_sheet(99, "New")

    def test_move_invalid_indices(self):
        md = "# Tables\n## Sheet1\n| A | B |"
        initialize_workbook(md, "{}")

        # Move invalid sheet
        assert "error" in move_sheet(99, 0)

    def test_delete_invalid_sheet(self):
        md = "# Tables\n## Sheet1\n"
        initialize_workbook(md, "{}")
        assert "error" in delete_sheet(99)
