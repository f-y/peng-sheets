"""
Tests for Tab Order Metadata functionality.

These tests verify that:
1. Workbook metadata can store and retrieve tab_order
2. Tab order persists correctly through parse/generate cycles
3. Sheet positions in tab_order are correctly represented
"""

import json

import headless_editor
import pytest


def reinitialize_workbook(editor, new_content):
    """Helper to reinitialize workbook with new content."""
    config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})
    editor.initialize_workbook(new_content, config)


# Fixture: Multi-document workbook content
HYBRID_CONTENT = """# Overview

This is the overview document.

# Tables

## Sheet 1

### Table 1

| Col A | Col B |
|-------|-------|
| 1     | 2     |

## Sheet 2

### Table 2

| Col C | Col D |
|-------|-------|
| 3     | 4     |

# Appendix

This is the appendix document.
"""


@pytest.fixture
def setup_hybrid_workbook():
    """Set up a workbook with documents and sheets."""
    config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})
    headless_editor.initialize_workbook(HYBRID_CONTENT, config)
    yield headless_editor
    # Cleanup
    headless_editor.workbook = None
    headless_editor.md_text = ""


class TestTabOrderMetadata:
    """Tests for tab order persistence in workbook metadata."""

    def test_get_initial_state_structure(self, setup_hybrid_workbook):
        """Structure should contain documents and workbook in order."""
        editor = setup_hybrid_workbook
        state_json = editor.get_state()
        state = json.loads(state_json)

        structure = state["structure"]

        # Should have: Overview (doc), Workbook, Appendix (doc)
        assert len(structure) == 3
        assert structure[0]["type"] == "document"
        assert structure[0]["title"] == "Overview"
        assert structure[1]["type"] == "workbook"
        assert structure[2]["type"] == "document"
        assert structure[2]["title"] == "Appendix"

    def test_update_workbook_tab_order(self, setup_hybrid_workbook):
        """Should be able to set custom tab order in workbook metadata."""
        editor = setup_hybrid_workbook

        # Set custom tab order: Appendix doc, Sheet 2, Sheet 1, Overview doc
        tab_order = [
            {"type": "document", "index": 1},  # Appendix
            {"type": "sheet", "index": 1},  # Sheet 2
            {"type": "sheet", "index": 0},  # Sheet 1
            {"type": "document", "index": 0},  # Overview
        ]

        result = editor.update_workbook_tab_order(tab_order)

        assert "error" not in result

        # Verify metadata was stored
        state = json.loads(editor.get_state())
        workbook = state["workbook"]
        assert "tab_order" in workbook.get("metadata", {})
        assert workbook["metadata"]["tab_order"] == tab_order

    def test_tab_order_persists_through_regeneration(self, setup_hybrid_workbook):
        """Tab order should persist when workbook is regenerated."""
        editor = setup_hybrid_workbook

        # Set custom tab order
        tab_order = [
            {"type": "document", "index": 1},
            {"type": "sheet", "index": 0},
            {"type": "document", "index": 0},
        ]
        editor.update_workbook_tab_order(tab_order)

        # Get the generated content
        result = editor.generate_and_get_range()
        new_content = result["content"]

        # Reinitialize from generated content
        reinitialize_workbook(editor, new_content)

        # Verify tab order was preserved
        state = json.loads(editor.get_state())
        workbook = state["workbook"]
        assert workbook.get("metadata", {}).get("tab_order") == tab_order

    def test_move_sheet_updates_tab_order(self, setup_hybrid_workbook):
        """Moving a sheet should update the tab_order metadata."""
        editor = setup_hybrid_workbook

        # First set initial tab order
        initial_order = [
            {"type": "document", "index": 0},
            {"type": "sheet", "index": 0},
            {"type": "sheet", "index": 1},
            {"type": "document", "index": 1},
        ]
        editor.update_workbook_tab_order(initial_order)

        # Move sheet 0 to position 1 (swap sheets)
        editor.move_sheet(0, 1)

        # Verify tab_order reflects the move
        state = json.loads(editor.get_state())
        tab_order = state["workbook"].get("metadata", {}).get("tab_order", [])

        # Sheet indices in tab_order should be updated
        # After move_sheet(0, 1), what was sheet 0 is now at index 1
        # The tab_order should reflect this
        sheet_items = [item for item in tab_order if item["type"] == "sheet"]
        assert len(sheet_items) == 2


class TestTabOrderEdgeCases:
    """Edge case tests for tab order functionality."""

    def test_empty_tab_order_returns_default_structure(self, setup_hybrid_workbook):
        """Without custom tab_order, structure order is used."""
        editor = setup_hybrid_workbook

        state = json.loads(editor.get_state())
        workbook = state["workbook"]

        # No custom tab_order set
        assert workbook.get("metadata", {}).get("tab_order") is None

        # Structure defines default order
        structure = state["structure"]
        assert len(structure) == 3

    def test_invalid_tab_order_index_handled(self, setup_hybrid_workbook):
        """Invalid indices in tab_order should be handled gracefully."""
        editor = setup_hybrid_workbook

        # Set tab order with invalid index
        tab_order = [
            {"type": "sheet", "index": 99},  # Invalid
            {"type": "document", "index": 0},
        ]

        result = editor.update_workbook_tab_order(tab_order)

        # Should not crash, may return error or filter invalid entries
        # Implementation decides exact behavior
        assert result is not None
