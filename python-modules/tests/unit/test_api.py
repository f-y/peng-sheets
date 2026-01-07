"""Tests for API layer functions.

The API layer is a thin wrapper around services that handles JSON I/O.
These tests verify the API functions work end-to-end.
"""

import json

import pytest
from md_spreadsheet_editor import api
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_parser import Sheet, Table, Workbook


@pytest.fixture
def context():
    """Reset context for each test."""
    ctx = EditorContext.get_instance()
    ctx.reset()
    return ctx


@pytest.fixture
def sample_md():
    return """# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
"""


@pytest.fixture
def sample_config():
    return json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})


class TestWorkbookOperations:
    """Tests for workbook-level API functions."""

    def test_initialize_workbook(self, context, sample_md, sample_config):
        """Initialize a workbook from markdown."""
        api.initialize_workbook(sample_md, sample_config)

        # Context should now have a workbook
        assert context.workbook is not None
        assert len(context.workbook.sheets) == 1

    def test_get_state(self, context, sample_md, sample_config):
        """Get the current state after initialization."""
        api.initialize_workbook(sample_md, sample_config)
        result = api.get_state()

        # Result should be a JSON string
        parsed = json.loads(result)
        assert "workbook" in parsed
        assert "structure" in parsed

    def test_create_new_spreadsheet(self, context):
        """Create a new spreadsheet from scratch."""
        result = api.create_new_spreadsheet()

        assert "content" in result
        assert context.workbook is not None
        assert len(context.workbook.sheets) == 1

    def test_create_new_spreadsheet_with_columns(self, context):
        """Create a new spreadsheet with custom columns."""
        result = api.create_new_spreadsheet(column_names=["ID", "Name", "Value"])

        assert context.workbook is not None
        sheet = context.workbook.sheets[0]
        assert sheet.tables[0].headers == ["ID", "Name", "Value"]

    def test_update_workbook_tab_order(self, context, sample_md, sample_config):
        """Update the tab order in metadata."""
        api.initialize_workbook(sample_md, sample_config)

        # Update tab order
        new_order = [{"type": "sheet", "index": 0}]
        result = api.update_workbook_tab_order(new_order)

        assert "error" not in result or result.get("error") is None
        assert context.workbook.metadata.get("tab_order") == new_order


class TestSheetOperations:
    """Tests for sheet-level API functions."""

    def test_add_sheet(self, context, sample_md, sample_config):
        """Add a new sheet."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.add_sheet("New Sheet")

        assert "error" not in result
        assert len(context.workbook.sheets) == 2
        assert context.workbook.sheets[1].name == "New Sheet"

    def test_rename_sheet(self, context, sample_md, sample_config):
        """Rename a sheet."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.rename_sheet(0, "Renamed Sheet")

        assert "error" not in result
        assert context.workbook.sheets[0].name == "Renamed Sheet"

    def test_delete_sheet(self, context, sample_md, sample_config):
        """Delete a sheet."""
        api.initialize_workbook(sample_md, sample_config)

        # Add a second sheet first
        api.add_sheet("Sheet 2")
        assert len(context.workbook.sheets) == 2

        # Delete the first sheet
        result = api.delete_sheet(0)

        assert "error" not in result
        assert len(context.workbook.sheets) == 1

    def test_move_sheet(self, context, sample_md, sample_config):
        """Move a sheet to a new position."""
        api.initialize_workbook(sample_md, sample_config)
        api.add_sheet("Sheet 2")

        result = api.move_sheet(0, 1)

        assert "error" not in result

    def test_update_sheet_metadata(self, context, sample_md, sample_config):
        """Update sheet metadata."""
        api.initialize_workbook(sample_md, sample_config)

        new_meta = {"custom": "value"}
        result = api.update_sheet_metadata(0, new_meta)

        assert "error" not in result


class TestTableOperations:
    """Tests for table-level API functions."""

    def test_add_table(self, context, sample_md, sample_config):
        """Add a new table to a sheet."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.add_table(0)

        assert "error" not in result
        assert len(context.workbook.sheets[0].tables) == 2

    def test_delete_table(self, context, sample_md, sample_config):
        """Delete a table from a sheet."""
        api.initialize_workbook(sample_md, sample_config)
        api.add_table(0)  # Add a second table first

        result = api.delete_table(0, 0)

        assert "error" not in result
        assert len(context.workbook.sheets[0].tables) == 1

    def test_rename_table(self, context, sample_md, sample_config):
        """Rename a table."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.rename_table(0, 0, "Renamed Table")

        assert "error" not in result

    def test_update_table_metadata(self, context, sample_md, sample_config):
        """Update table name and description."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.update_table_metadata(0, 0, "New Name", "New Description")

        assert "error" not in result

    def test_update_visual_metadata(self, context, sample_md, sample_config):
        """Update visual metadata."""
        api.initialize_workbook(sample_md, sample_config)

        visual_meta = {"columns": {"0": {"width": 100}}}
        result = api.update_visual_metadata(0, 0, visual_meta)

        assert "error" not in result


class TestCellOperations:
    """Tests for cell-level API functions."""

    def test_update_cell(self, context, sample_md, sample_config):
        """Update a cell value."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.update_cell(0, 0, 0, 0, "Updated")

        assert "error" not in result

    def test_insert_row(self, context, sample_md, sample_config):
        """Insert a new row."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.insert_row(0, 0, 0)

        assert "error" not in result

    def test_delete_row(self, context, sample_md, sample_config):
        """Delete a row."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.delete_row(0, 0, 0)

        assert "error" not in result

    def test_delete_rows(self, context, sample_md, sample_config):
        """Delete multiple rows."""
        api.initialize_workbook(sample_md, sample_config)
        api.insert_row(0, 0, 0)  # Add a row first

        result = api.delete_rows(0, 0, [0])

        assert "error" not in result

    def test_move_rows(self, context, sample_md, sample_config):
        """Move rows."""
        api.initialize_workbook(sample_md, sample_config)
        api.insert_row(0, 0, 0)  # Add another row

        result = api.move_rows(0, 0, [0], 2)

        assert "error" not in result

    def test_sort_rows(self, context, sample_md, sample_config):
        """Sort rows by a column."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.sort_rows(0, 0, 0, True)

        assert "error" not in result


class TestColumnOperations:
    """Tests for column-level API functions."""

    def test_insert_column(self, context, sample_md, sample_config):
        """Insert a new column."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.insert_column(0, 0, 0)

        assert "error" not in result

    def test_delete_column(self, context, sample_md, sample_config):
        """Delete a column."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.delete_column(0, 0, 0)

        assert "error" not in result

    def test_delete_columns(self, context, sample_md, sample_config):
        """Delete multiple columns."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.delete_columns(0, 0, [0])

        assert "error" not in result

    def test_move_columns(self, context, sample_md, sample_config):
        """Move columns."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.move_columns(0, 0, [0], 2)

        assert "error" not in result

    def test_clear_column(self, context, sample_md, sample_config):
        """Clear a column."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.clear_column(0, 0, 0)

        assert "error" not in result

    def test_clear_columns(self, context, sample_md, sample_config):
        """Clear multiple columns."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.clear_columns(0, 0, [0])

        assert "error" not in result

    def test_update_column_width(self, context, sample_md, sample_config):
        """Update column width."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.update_column_width(0, 0, 0, 150)

        assert "error" not in result

    def test_update_column_format(self, context, sample_md, sample_config):
        """Update column format."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.update_column_format(0, 0, 0, "number")

        assert "error" not in result

    def test_update_column_align(self, context, sample_md, sample_config):
        """Update column alignment."""
        api.initialize_workbook(sample_md, sample_config)

        result = api.update_column_align(0, 0, 0, "center")

        assert "error" not in result


class TestBulkOperations:
    """Tests for bulk cell operations."""

    def test_paste_cells(self, context, sample_md, sample_config):
        """Paste cells."""
        api.initialize_workbook(sample_md, sample_config)

        new_data = [["X", "Y"], ["Z", "W"]]
        result = api.paste_cells(0, 0, 0, 0, new_data)

        assert "error" not in result

    def test_move_cells(self, context, sample_md, sample_config):
        """Move cells."""
        api.initialize_workbook(sample_md, sample_config)

        src_range = {"minR": 0, "maxR": 0, "minC": 0, "maxC": 0}
        result = api.move_cells(0, 0, src_range, 1, 1)

        assert "error" not in result


class TestDocumentOperations:
    """Tests for document-level API functions."""

    def test_get_document_section_range(self, context):
        """Get document section range."""
        md = """# Doc 1

Content.

# Tables
"""
        config = json.dumps({"rootMarker": "# Tables"})
        api.initialize_workbook(md, config)

        result = api.get_document_section_range(0)

        assert "error" not in result
        assert "start_line" in result

    def test_add_document(self, context, sample_config):
        """Add a new document."""
        md = """# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        api.initialize_workbook(md, sample_config)

        result = api.add_document("New Doc")

        assert "error" not in result

    def test_add_document_and_get_full_update(self, context, sample_config):
        """Add document and get full update."""
        md = """# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        api.initialize_workbook(md, sample_config)

        result = api.add_document_and_get_full_update("New Doc")

        assert "error" not in result

    def test_rename_document(self, context):
        """Rename a document."""
        md = """# Doc 1

Content.

# Tables
"""
        config = json.dumps({"rootMarker": "# Tables"})
        api.initialize_workbook(md, config)

        result = api.rename_document(0, "Renamed Doc")

        assert "error" not in result

    def test_delete_document(self, context):
        """Delete a document."""
        md = """# Doc 1

Content.

# Doc 2

More content.

# Tables
"""
        config = json.dumps({"rootMarker": "# Tables"})
        api.initialize_workbook(md, config)

        result = api.delete_document(0)

        assert "error" not in result

    def test_delete_document_and_get_full_update(self, context):
        """Delete document and get full update."""
        md = """# Doc 1

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        config = json.dumps({"rootMarker": "# Tables"})
        api.initialize_workbook(md, config)

        result = api.delete_document_and_get_full_update(0)

        assert "error" not in result

    def test_move_document_section(self, context):
        """Move a document section."""
        md = """# Doc 1

Doc 1 content.

# Doc 2

Doc 2 content.

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        config = json.dumps({"rootMarker": "# Tables"})
        api.initialize_workbook(md, config)

        result = api.move_document_section(0, to_doc_index=2)

        assert "error" not in result

    def test_move_workbook_section(self, context):
        """Move the workbook section."""
        md = """# Doc 1

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        config = json.dumps({"rootMarker": "# Tables"})
        api.initialize_workbook(md, config)

        result = api.move_workbook_section(to_doc_index=0, to_before_doc=True)

        assert "error" not in result
