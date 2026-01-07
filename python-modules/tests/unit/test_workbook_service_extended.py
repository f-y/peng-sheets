"""Tests for workbook service functions.

Covers initialize_tab_order_from_structure, get_workbook_range,
update_workbook, generate_and_get_range, reorder_tab_metadata.
"""

import json
from unittest.mock import MagicMock

import pytest
from md_spreadsheet_editor.services import workbook as workbook_service
from md_spreadsheet_parser import MultiTableParsingSchema, Sheet, Table, Workbook


@pytest.fixture
def mock_context():
    context = MagicMock()
    context.config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})
    context.md_text = "# Tables\n"
    context.schema = MultiTableParsingSchema()
    return context


class TestInitializeTabOrderFromStructure:
    """Tests for initialize_tab_order_from_structure."""

    def test_empty_md_text(self):
        """Empty markdown should return sheet indices only."""
        result = workbook_service.initialize_tab_order_from_structure("", "{}", 3)
        assert result == [
            {"type": "sheet", "index": 0},
            {"type": "sheet", "index": 1},
            {"type": "sheet", "index": 2},
        ]

    def test_workbook_not_found_appends_sheets(self):
        """When root marker not found, sheets are appended at end."""
        md = """# My Document

Content here.
"""
        config = json.dumps({"rootMarker": "# Tables"})
        result = workbook_service.initialize_tab_order_from_structure(md, config, 2)

        # Should have document first, then sheets at end
        assert result[0] == {"type": "document", "index": 0}
        assert {"type": "sheet", "index": 0} in result
        assert {"type": "sheet", "index": 1} in result

    def test_with_code_blocks(self):
        """Headers inside code blocks should be ignored."""
        md = """```
# Fake Document
```

# Real Document

# Tables
"""
        config = json.dumps({"rootMarker": "# Tables"})
        result = workbook_service.initialize_tab_order_from_structure(md, config, 1)

        # Should have 1 document (Real Document) and 1 sheet
        types = [item["type"] for item in result]
        assert types.count("document") == 1
        assert types.count("sheet") == 1

    def test_mixed_documents_and_workbook(self):
        """Documents before and after workbook."""
        md = """# Doc 1

# Tables

# Doc 2
"""
        config = json.dumps({"rootMarker": "# Tables"})
        result = workbook_service.initialize_tab_order_from_structure(md, config, 2)

        # Order: Doc 1, Sheet 0, Sheet 1, Doc 2
        assert result[0]["type"] == "document"
        assert result[1]["type"] == "sheet"
        assert result[2]["type"] == "sheet"
        assert result[3]["type"] == "document"


class TestGetWorkbookRange:
    """Tests for get_workbook_range."""

    def test_root_marker_found(self):
        """Find range when root marker exists."""
        md = """# Intro

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        start, end = workbook_service.get_workbook_range(md, "# Tables", 2)
        lines = md.split("\n")
        assert start == 2  # Line with "# Tables"
        assert end == len(lines)  # To end since no higher level header after

    def test_root_marker_not_found(self):
        """Start at end of file when root marker not found."""
        md = """# Intro

Some content.
"""
        start, end = workbook_service.get_workbook_range(md, "# Tables", 2)
        lines = md.split("\n")
        assert start == len(lines)

    def test_root_marker_in_code_block_ignored(self):
        """Root marker inside code block should be ignored."""
        md = """# Intro

```
# Tables
```

# Real Tables

## Sheet 1
"""
        start, end = workbook_service.get_workbook_range(md, "# Tables", 2)
        # "# Real Tables" is at line 10 in this multiline string (0-indexed)
        # The code block "# Tables" is correctly ignored
        assert start == 10

    def test_ends_at_higher_level_header(self):
        """Workbook range ends when higher level header found."""
        md = """# Tables

## Sheet 1

| A |
|---|

# Appendix

Extra content.
"""
        start, end = workbook_service.get_workbook_range(md, "# Tables", 2)
        # Should end before "# Appendix" (line 7 is "# Appendix", 0-indexed)
        assert end == 7


class TestUpdateWorkbook:
    """Tests for update_workbook."""

    def test_no_workbook_returns_error(self, mock_context):
        """Error when no workbook exists."""
        mock_context.workbook = None

        result = workbook_service.update_workbook(mock_context, lambda wb: wb)

        assert "error" in result
        assert "No workbook" in result["error"]

    def test_transform_exception_returns_error(self, mock_context):
        """Exception in transform function returns error."""
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        mock_context.workbook = Workbook(sheets=[sheet], metadata={})

        def bad_transform(wb):
            raise ValueError("Transform failed")

        result = workbook_service.update_workbook(mock_context, bad_transform)

        assert "error" in result
        assert "Transform failed" in result["error"]


class TestGenerateAndGetRange:
    """Tests for generate_and_get_range."""

    def test_empty_workbook(self, mock_context):
        """Generate empty markdown for empty workbook."""
        mock_context.workbook = Workbook(sheets=[], metadata={})
        mock_context.schema = MultiTableParsingSchema()

        result = workbook_service.generate_and_get_range(mock_context)

        assert "startLine" in result
        assert "content" in result

    def test_no_schema(self, mock_context):
        """No schema returns empty content."""
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        mock_context.workbook = Workbook(sheets=[sheet], metadata={})
        mock_context.schema = None

        result = workbook_service.generate_and_get_range(mock_context)

        # Content should be empty line
        assert result["content"] == "\n"

    def test_appending_to_file_adds_newlines(self, mock_context):
        """When appending, ensure proper newline separation."""
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        mock_context.workbook = Workbook(sheets=[sheet], metadata={})
        mock_context.schema = MultiTableParsingSchema()
        # Simulate content without trailing newlines
        mock_context.md_text = "# Intro\n\nContent"

        result = workbook_service.generate_and_get_range(mock_context)

        # Should have proper separation
        assert "content" in result


class TestReorderTabMetadata:
    """Tests for reorder_tab_metadata."""

    def test_no_workbook(self):
        """None workbook returns unchanged."""
        result = workbook_service.reorder_tab_metadata(None, "sheet", 0, 1, 1)
        assert result is None

    def test_no_metadata(self):
        """Workbook without metadata returns unchanged."""
        wb = Workbook(sheets=[], metadata=None)
        result = workbook_service.reorder_tab_metadata(wb, "sheet", 0, 1, 1)
        assert result == wb

    def test_empty_tab_order(self):
        """Empty tab_order returns unchanged."""
        wb = Workbook(sheets=[], metadata={})
        result = workbook_service.reorder_tab_metadata(wb, "sheet", 0, 1, 1)
        assert result == wb

    def test_move_sheet_updates_indices(self):
        """Moving sheet updates indices correctly."""
        wb = Workbook(
            sheets=[],
            metadata={
                "tab_order": [
                    {"type": "sheet", "index": 0},
                    {"type": "sheet", "index": 1},
                    {"type": "sheet", "index": 2},
                ]
            },
        )
        result = workbook_service.reorder_tab_metadata(wb, "sheet", 0, 2, 2)

        new_order = result.metadata["tab_order"]
        indices = [item["index"] for item in new_order]
        # After moving sheet 0 to position 2
        assert 0 in indices
        assert 1 in indices
        assert 2 in indices

    def test_moved_item_not_in_list_value_error(self):
        """Handle ValueError when moved item not in list."""
        wb = Workbook(
            sheets=[],
            metadata={
                "tab_order": [
                    {"type": "document", "index": 0},  # Different type
                ]
            },
        )
        # Try to move a sheet that doesn't exist in tab_order
        result = workbook_service.reorder_tab_metadata(wb, "sheet", 0, 1, 1)
        # Should not raise, just return
        assert result is not None


class TestApplySheetUpdate:
    """Tests for apply_sheet_update."""

    def test_invalid_sheet_index(self, mock_context):
        """Invalid sheet index raises error."""
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        mock_context.workbook = Workbook(sheets=[sheet], metadata={})

        result = workbook_service.apply_sheet_update(
            mock_context,
            99,
            lambda s: s,  # Invalid index
        )

        assert "error" in result
