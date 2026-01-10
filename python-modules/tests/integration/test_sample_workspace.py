"""Integration tests using sample-workspace files.

These tests verify end-to-end functionality with real markdown files
from the sample-workspace directory.
"""

import os

import pytest
from md_spreadsheet_editor import api
from md_spreadsheet_editor.context import EditorContext

SAMPLE_WORKSPACE = os.path.join(
    os.path.dirname(__file__),
    "..",
    "..",
    "..",
    "sample-workspace",
)


@pytest.fixture
def context():
    """Fresh context for each test."""
    ctx = EditorContext.get_instance()
    ctx.reset()
    return ctx


def read_sample_file(filename):
    """Read a file from sample-workspace."""
    path = os.path.join(SAMPLE_WORKSPACE, filename)
    if os.path.exists(path):
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    return None


class TestHybridNotebook:
    """Tests using hybrid_notebook.md which has mixed documents and sheets."""

    def test_parse_hybrid_notebook(self, context):
        """Parse hybrid_notebook.md with documents and sheets."""
        md = read_sample_file("hybrid_notebook.md")
        if md is None:
            pytest.skip("hybrid_notebook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        assert context.workbook is not None
        assert len(context.workbook.sheets) > 0

    def test_get_state_with_structure(self, context):
        """Get full state including structure information."""
        md = read_sample_file("hybrid_notebook.md")
        if md is None:
            pytest.skip("hybrid_notebook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        import json

        state = json.loads(api.get_state())

        assert "workbook" in state
        assert "structure" in state
        # Should have document sections in structure
        if state["structure"]:
            types = [s["type"] for s in state["structure"]]
            assert "workbook" in types

    def test_edit_operations_chain(self, context):
        """Chain of edit operations on the workbook."""
        md = read_sample_file("hybrid_notebook.md")
        if md is None:
            pytest.skip("hybrid_notebook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        initial_sheet_count = len(context.workbook.sheets)

        # Add a new sheet
        api.add_sheet("Test Sheet")
        assert len(context.workbook.sheets) == initial_sheet_count + 1

        # Rename it
        new_idx = len(context.workbook.sheets) - 1
        api.rename_sheet(new_idx, "Renamed Test Sheet")
        assert context.workbook.sheets[new_idx].name == "Renamed Test Sheet"

        # Delete it
        api.delete_sheet(new_idx)
        assert len(context.workbook.sheets) == initial_sheet_count


class TestStandardWorkbook:
    """Tests using standard_workbook.md which is a simple workbook."""

    def test_parse_standard_workbook(self, context):
        """Parse standard_workbook.md."""
        md = read_sample_file("standard_workbook.md")
        if md is None:
            pytest.skip("standard_workbook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        assert context.workbook is not None

    def test_cell_operations(self, context):
        """Test cell operations on standard workbook."""
        md = read_sample_file("standard_workbook.md")
        if md is None:
            pytest.skip("standard_workbook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        if len(context.workbook.sheets) == 0:
            pytest.skip("No sheets in workbook")

        if len(context.workbook.sheets[0].tables) == 0:
            pytest.skip("No tables in first sheet")

        # Update a cell
        result = api.update_cell(0, 0, 0, 0, "Test Value")
        assert "error" not in result

        # Insert a row
        result = api.insert_row(0, 0, 0)
        assert "error" not in result


class TestWorkbookMd:
    """Tests using workbook.md which contains Japanese content."""

    def test_parse_japanese_content(self, context):
        """Parse workbook.md with Japanese content."""
        md = read_sample_file("workbook.md")
        if md is None:
            pytest.skip("workbook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        assert context.workbook is not None

    def test_japanese_in_cells(self, context):
        """Handle Japanese characters in cell values."""
        md = read_sample_file("workbook.md")
        if md is None:
            pytest.skip("workbook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        if len(context.workbook.sheets) == 0:
            pytest.skip("No sheets in workbook")

        if len(context.workbook.sheets[0].tables) == 0:
            pytest.skip("No tables in first sheet")

        # Update cell with Japanese content
        result = api.update_cell(0, 0, 0, 0, "日本語テスト")
        assert "error" not in result


class TestOnboardingEmpty:
    """Tests using onboarding_empty.md which is a minimal file."""

    def test_parse_empty_workbook(self, context):
        """Parse onboarding_empty.md."""
        md = read_sample_file("onboarding_empty.md")
        if md is None:
            pytest.skip("onboarding_empty.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        assert context.workbook is not None


class TestEmptyFile:
    """Tests using empty.md."""

    def test_parse_completely_empty(self, context):
        """Parse completely empty file."""
        md = read_sample_file("empty.md")
        if md is None:
            md = ""  # Test with empty content

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        # Should still have a workbook object
        assert context.workbook is not None


class TestMetadataIntegrity:
    """Tests for metadata consistency across operations."""

    def test_tab_order_consistency(self, context):
        """Tab order should remain consistent after operations."""
        md = read_sample_file("hybrid_notebook.md")
        if md is None:
            pytest.skip("hybrid_notebook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        # Get initial state
        import json

        initial_state = json.loads(api.get_state())

        # Add a sheet
        api.add_sheet("New Test Sheet")

        # Get new state
        new_state = json.loads(api.get_state())

        # Tab order should have been updated
        if context.workbook.metadata:
            tab_order = context.workbook.metadata.get("tab_order", [])
            sheet_count = sum(1 for t in tab_order if t["type"] == "sheet")
            assert sheet_count == len(context.workbook.sheets)

    def test_structure_after_document_add(self, context):
        """Structure should update after adding a document."""
        md = read_sample_file("standard_workbook.md")
        if md is None:
            pytest.skip("standard_workbook.md not found")

        config = '{"rootMarker": "# Tables", "sheetHeaderLevel": 2}'
        api.initialize_workbook(md, config)

        # Add a document
        result = api.add_document("New Document Section")
        assert "error" not in result

        # Get state and check structure
        import json

        state = json.loads(api.get_state())
        if state["structure"]:
            doc_sections = [s for s in state["structure"] if s["type"] == "document"]
            assert len(doc_sections) >= 1
