"""Tests for table CRUD operations that lack coverage.

Specifically covering add_table, delete_table, and rename_table.
"""

from unittest.mock import MagicMock, patch

import pytest
from md_spreadsheet_editor.services import table as table_service
from md_spreadsheet_parser import Sheet, Table, Workbook


@pytest.fixture
def mock_context():
    context = MagicMock()
    context.update_state = MagicMock()
    return context


@pytest.fixture
def sample_workbook():
    tables = [
        Table(
            name="Table 1",
            description="First table",
            headers=["Col 1", "Col 2"],
            rows=[["A", "B"], ["C", "D"]],
            metadata={},
        )
    ]
    sheet = Sheet(name="Sheet 1", tables=tables)
    return Workbook(sheets=[sheet], metadata={})


class TestAddTable:
    """Tests for add_table function (lines 9-25)."""

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_add_table_basic(self, mock_apply_update, mock_context, sample_workbook):
        """Add a table with default settings."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.add_table(mock_context, 0)

        mock_apply_update.assert_called_once()
        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        sheet = sample_workbook.sheets[0]
        new_sheet = transform_func(sheet)

        # Should have 2 tables now
        assert len(new_sheet.tables) == 2

        # New table should have default columns
        new_table = new_sheet.tables[1]
        assert len(new_table.headers) == 3  # Default columns
        assert len(new_table.rows) == 1  # One empty row

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_add_table_with_custom_columns(
        self, mock_apply_update, mock_context, sample_workbook
    ):
        """Add a table with custom column names."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        custom_columns = ["ID", "Name", "Value", "Status"]
        table_service.add_table(mock_context, 0, column_names=custom_columns)

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        sheet = sample_workbook.sheets[0]
        new_sheet = transform_func(sheet)

        new_table = new_sheet.tables[1]
        assert new_table.headers == custom_columns
        assert len(new_table.rows[0]) == 4

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_add_table_with_custom_name(
        self, mock_apply_update, mock_context, sample_workbook
    ):
        """Add a table with a custom name."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.add_table(mock_context, 0, table_name="My Custom Table")

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        sheet = sample_workbook.sheets[0]
        new_sheet = transform_func(sheet)

        new_table = new_sheet.tables[1]
        assert new_table.name == "My Custom Table"


class TestDeleteTable:
    """Tests for delete_table function (lines 29-37)."""

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_delete_table_basic(self, mock_apply_update, mock_context):
        """Delete a table from a sheet."""
        tables = [
            Table(headers=["A"], rows=[["1"]], metadata={}, name="Table 1"),
            Table(headers=["B"], rows=[["2"]], metadata={}, name="Table 2"),
        ]
        sheet = Sheet(name="Sheet 1", tables=tables)
        workbook = Workbook(sheets=[sheet], metadata={})
        mock_context.workbook = workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.delete_table(mock_context, 0, 0)

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        new_sheet = transform_func(sheet)

        # Should have 1 table now
        assert len(new_sheet.tables) == 1
        assert new_sheet.tables[0].name == "Table 2"

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_delete_last_table(self, mock_apply_update, mock_context):
        """Delete the only table in a sheet."""
        tables = [Table(headers=["A"], rows=[["1"]], metadata={}, name="Table 1")]
        sheet = Sheet(name="Sheet 1", tables=tables)
        workbook = Workbook(sheets=[sheet], metadata={})
        mock_context.workbook = workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.delete_table(mock_context, 0, 0)

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        new_sheet = transform_func(sheet)
        assert len(new_sheet.tables) == 0


class TestRenameTable:
    """Tests for rename_table function (lines 41-51)."""

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_rename_table_basic(self, mock_apply_update, mock_context, sample_workbook):
        """Rename a table."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.rename_table(mock_context, 0, 0, "New Table Name")

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        sheet = sample_workbook.sheets[0]
        new_sheet = transform_func(sheet)

        assert new_sheet.tables[0].name == "New Table Name"

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_rename_table_empty_name(
        self, mock_apply_update, mock_context, sample_workbook
    ):
        """Rename a table to empty string."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.rename_table(mock_context, 0, 0, "")

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        sheet = sample_workbook.sheets[0]
        new_sheet = transform_func(sheet)

        assert new_sheet.tables[0].name == ""


class TestInferColumnType:
    """Tests for _infer_column_type helper (lines 235-261)."""

    def test_infer_numeric_column(self):
        """Should infer numeric type for columns with numbers."""
        rows = [["100"], ["200"], ["-50"], ["3.14"]]
        metadata = {}
        result = table_service._infer_column_type(rows, 0, metadata)
        assert result == "number"

    def test_infer_text_column(self):
        """Should infer string type for columns with mixed content."""
        rows = [["hello"], ["world"], ["123abc"]]
        metadata = {}
        result = table_service._infer_column_type(rows, 0, metadata)
        assert result == "string"

    def test_infer_type_from_visual_metadata(self):
        """Should use visual metadata type if available."""
        rows = [["2024-01-01"], ["2024-02-15"]]
        # Implementation checks visual.columns.X.type
        metadata = {"visual": {"columns": {"0": {"type": "date"}}}}
        result = table_service._infer_column_type(rows, 0, metadata)
        assert result == "date"

    def test_infer_empty_column(self):
        """Should handle empty columns."""
        rows = [[""], [""]]
        metadata = {}
        result = table_service._infer_column_type(rows, 0, metadata)
        assert result == "string"  # Default to string


class TestGetSortKey:
    """Tests for _get_sort_key helper (lines 266-278)."""

    def test_sort_key_number(self):
        """Get sort key for numeric value."""
        row = ["100", "text"]
        result = table_service._get_sort_key(row, 0, "number")
        assert result == 100.0

    def test_sort_key_text(self):
        """Get sort key for text value."""
        row = ["hello", "world"]
        result = table_service._get_sort_key(row, 0, "text")
        assert result == "hello"

    def test_sort_key_invalid_number(self):
        """Invalid number should return -infinity for proper sorting."""
        row = ["not_a_number", "text"]
        result = table_service._get_sort_key(row, 0, "number")
        # Implementation returns -inf to sort invalid numbers to beginning
        assert result == float("-inf")


class TestSortRowsEdgeCases:
    """Edge case tests for sort_rows."""

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_sort_empty_table(self, mock_apply_update, mock_context):
        """Sorting an empty table should not error."""
        tables = [Table(headers=["A"], rows=[], metadata={}, name="Empty")]
        sheet = Sheet(name="Sheet 1", tables=tables)
        workbook = Workbook(sheets=[sheet], metadata={})
        mock_context.workbook = workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.sort_rows(mock_context, 0, 0, 0, True)

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        new_sheet = transform_func(sheet)
        assert len(new_sheet.tables[0].rows) == 0

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_sort_single_row(self, mock_apply_update, mock_context):
        """Sorting single row table should not error."""
        tables = [Table(headers=["A"], rows=[["1"]], metadata={}, name="Single")]
        sheet = Sheet(name="Sheet 1", tables=tables)
        workbook = Workbook(sheets=[sheet], metadata={})
        mock_context.workbook = workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.sort_rows(mock_context, 0, 0, 0, True)

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        new_sheet = transform_func(sheet)
        assert new_sheet.tables[0].rows == [["1"]]


class TestPasteCellsEdgeCases:
    """Edge case tests for paste_cells."""

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_paste_empty_data(self, mock_apply_update, mock_context, sample_workbook):
        """Pasting empty data should not error."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        table_service.paste_cells(mock_context, 0, 0, 0, 0, [])

        # Should complete without error


class TestMoveCellsEdgeCases:
    """Edge case tests for move_cells."""

    @patch("md_spreadsheet_editor.services.table.apply_sheet_update")
    def test_move_cells_same_location(
        self, mock_apply_update, mock_context, sample_workbook
    ):
        """Moving cells to same location."""
        mock_context.workbook = sample_workbook
        mock_apply_update.return_value = {"file_changed": True}

        src_range = {"minR": 0, "maxR": 0, "minC": 0, "maxC": 0}
        table_service.move_cells(mock_context, 0, 0, src_range, 0, 0)

        args = mock_apply_update.call_args[0]
        transform_func = args[2]

        sheet = sample_workbook.sheets[0]
        new_sheet = transform_func(sheet)

        # Value should remain
        assert new_sheet.tables[0].rows[0][0] == "A"
