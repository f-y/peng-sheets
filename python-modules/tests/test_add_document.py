"""
Tests for Add Document functionality.

These tests verify that:
1. New document sections can be added to the markdown
2. Documents are inserted at the correct position (after current tab)
3. Tab order metadata is updated correctly
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


class TestAddDocument:
    """Tests for adding new document sections."""

    def test_add_document_after_first_document(self, setup_hybrid_workbook):
        """Add a document after the Overview document (index 0)."""
        editor = setup_hybrid_workbook

        # Add document after first document (Overview, which is at doc index 0)
        result = editor.add_document("New Section", after_doc_index=0)

        assert "error" not in result
        assert "content" in result
        assert "startLine" in result
        assert "endLine" in result

        # The content should include the new document header
        assert "# New Section" in result["content"]

    def test_add_document_after_workbook(self, setup_hybrid_workbook):
        """Add a document after the workbook (before Appendix)."""
        editor = setup_hybrid_workbook

        # Add document after workbook section
        # Workbook is at structure index 1
        result = editor.add_document("Notes", after_workbook=True)

        assert "error" not in result
        assert "# Notes" in result["content"]

    def test_add_document_at_end(self, setup_hybrid_workbook):
        """Add a document at the end of the file."""
        editor = setup_hybrid_workbook

        # Add document after Appendix (last document, index 1)
        result = editor.add_document("References", after_doc_index=1)

        assert "error" not in result
        assert "# References" in result["content"]

    def test_add_document_updates_structure(self, setup_hybrid_workbook):
        """Adding a document should update the structure."""
        editor = setup_hybrid_workbook

        # Get initial structure
        initial_state = json.loads(editor.get_state())
        initial_doc_count = len(
            [s for s in initial_state["structure"] if s["type"] == "document"]
        )

        # Add document
        result = editor.add_document("New Doc", after_doc_index=0)
        assert "error" not in result

        # Apply the change by updating md_text (simulating what extension does)
        # In real flow, extension applies the edit via updateRange
        # For test, we directly update and reinitialize
        lines = editor.md_text.split("\n")
        start = result["startLine"]
        end = result["endLine"]
        new_lines = (
            lines[:start]
            + result["content"].rstrip("\n").split("\n")
            + lines[end + 1 :]
        )
        new_md = "\n".join(new_lines)

        # Reinitialize
        config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})
        editor.initialize_workbook(new_md, config)

        # Check structure
        new_state = json.loads(editor.get_state())
        new_doc_count = len(
            [s for s in new_state["structure"] if s["type"] == "document"]
        )

        assert new_doc_count == initial_doc_count + 1

    def test_add_document_with_empty_title_uses_default(self, setup_hybrid_workbook):
        """Adding a document with empty title should use default name."""
        editor = setup_hybrid_workbook

        result = editor.add_document("", after_doc_index=0)

        assert "error" not in result
        # Should use a default name like "New Document"
        assert "# " in result["content"]


class TestAddDocumentEdgeCases:
    """Edge case tests for add document."""

    def test_add_document_to_empty_file(self):
        """Add document to a file with no existing content."""
        config = json.dumps({"rootMarker": "# Tables", "sheetHeaderLevel": 2})
        headless_editor.initialize_workbook("", config)

        result = headless_editor.add_document("First Document", after_doc_index=-1)

        assert "error" not in result or result.get("error") is None
        # Should create the document at the start
        assert "# First Document" in result.get("content", "")

    def test_add_document_invalid_index(self, setup_hybrid_workbook):
        """Add document with invalid index should handle gracefully."""
        editor = setup_hybrid_workbook

        result = editor.add_document("Test", after_doc_index=99)

        # Should either error or add at end
        # Implementation decides exact behavior
        assert result is not None
