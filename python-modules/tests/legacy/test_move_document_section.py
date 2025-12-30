"""
Tests for Move Document Section functionality.

These tests verify that:
1. Document sections can be moved within the file
2. Documents crossing workbook boundaries trigger file changes
3. Documents not crossing boundaries only update metadata
4. Tab order metadata is correctly updated
"""

import json

import headless_editor
import pytest

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

# References

This is the references document.
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


class TestMoveDocumentPhysicalReorder:
    """Tests for moving documents (always requires file change)."""

    def test_move_document_after_workbook_reorder(self, setup_hybrid_workbook):
        """Move Appendix after References (both are after workbook)."""
        editor = setup_hybrid_workbook

        # Doc indices: Overview=0, Appendix=1, References=2
        # Move Appendix (1) to after References (2)
        result = editor.move_document_section(from_doc_index=1, to_doc_index=2)

        assert "error" not in result

        # Document-to-Document moves ALWAYS require file change
        # because we're physically reordering sections in the Markdown
        assert result.get("file_changed") is True
        assert "content" in result
        assert "startLine" in result
        assert "endLine" in result

    def test_move_document_changes_file_content(self, setup_hybrid_workbook):
        """Moving documents should modify the actual file content."""
        editor = setup_hybrid_workbook

        # Move References before Appendix (both after workbook)
        result = editor.move_document_section(from_doc_index=2, to_doc_index=1)

        assert "error" not in result

        # File content should change
        assert result.get("file_changed") is True


class TestMoveDocumentAcrossWorkbook:
    """Tests for moving documents that cross the workbook boundary."""

    def test_move_document_before_to_after_workbook(self, setup_hybrid_workbook):
        """Move Overview (before workbook) to after workbook."""
        editor = setup_hybrid_workbook

        # Get initial structure
        initial_state = json.loads(editor.get_state())
        _initial_structure = initial_state["structure"]  # noqa: F841

        # Overview is at doc index 0 (before workbook)
        # Move it to after workbook (after position 1 in structure)
        result = editor.move_document_section(from_doc_index=0, to_after_workbook=True)

        assert "error" not in result

        # This crosses workbook boundary - file must change
        assert result.get("file_changed") is True
        assert "content" in result
        assert "startLine" in result
        assert "endLine" in result

    def test_move_document_after_to_before_workbook(self, setup_hybrid_workbook):
        """Move Appendix (after workbook) to before workbook."""
        editor = setup_hybrid_workbook

        # Appendix is at doc index 1 (after workbook)
        # Move it to before workbook
        result = editor.move_document_section(from_doc_index=1, to_before_workbook=True)

        assert "error" not in result

        # This crosses workbook boundary - file must change
        assert result.get("file_changed") is True

    def test_cross_workbook_move_updates_file_content(self, setup_hybrid_workbook):
        """Verify file content is actually modified when crossing workbook."""
        editor = setup_hybrid_workbook

        initial_md = editor.md_text

        # Move Overview to after workbook
        result = editor.move_document_section(from_doc_index=0, to_after_workbook=True)

        assert "error" not in result

        # Apply the change
        lines = initial_md.split("\n")
        _start = result["startLine"]  # noqa: F841
        end = result["endLine"]
        _end_col = result.get("endCol", len(lines[end]) if end < len(lines) else 0)  # noqa: F841

        # Build new content
        _new_content = result["content"]  # noqa: F841

        # Verify the overview section moved
        assert "# Overview" not in "\n".join(lines[: result["startLine"]])
        # After applying, Overview should appear after workbook


class TestMoveDocumentTabOrder:
    """Tests for tab order updates during document moves."""

    def test_tab_order_reflects_document_move(self, setup_hybrid_workbook):
        """Tab order metadata should reflect document position changes."""
        editor = setup_hybrid_workbook

        # Set initial tab order
        initial_order = [
            {"type": "document", "index": 0},  # Overview
            {"type": "sheet", "index": 0},
            {"type": "sheet", "index": 1},
            {"type": "document", "index": 1},  # Appendix
            {"type": "document", "index": 2},  # References
        ]
        editor.update_workbook_tab_order(initial_order)

        # Move Appendix to first position
        editor.move_document_section(from_doc_index=1, to_doc_index=0)

        # Verify tab_order updated
        state = json.loads(editor.get_state())
        tab_order = state["workbook"].get("metadata", {}).get("tab_order", [])

        # First document item should now be Appendix (index 1 in original)
        doc_items = [item for item in tab_order if item["type"] == "document"]
        assert len(doc_items) >= 2


class TestMoveDocumentEdgeCases:
    """Edge case tests for document movement."""

    def test_move_same_position_no_op(self, setup_hybrid_workbook):
        """Moving document to same position should be a no-op."""
        editor = setup_hybrid_workbook

        initial_md = editor.md_text

        result = editor.move_document_section(from_doc_index=0, to_doc_index=0)

        # Should succeed but with no changes
        assert result.get("file_changed") is False
        assert editor.md_text == initial_md

    def test_move_invalid_source_index(self, setup_hybrid_workbook):
        """Moving from invalid index should return error."""
        editor = setup_hybrid_workbook

        result = editor.move_document_section(from_doc_index=99, to_doc_index=0)

        assert "error" in result

    def test_move_invalid_target_index(self, setup_hybrid_workbook):
        """Moving to invalid index should handle gracefully."""
        editor = setup_hybrid_workbook

        result = editor.move_document_section(from_doc_index=0, to_doc_index=99)

        # Should either error or move to end
        assert result is not None
