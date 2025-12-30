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

        # add_document updates md_text directly, so we just reinitialize with it
        new_md = editor.md_text

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

    def test_add_document_updates_existing_tab_order(self, setup_hybrid_workbook):
        """If tab_order exists, add_document should update it efficiently."""
        editor = setup_hybrid_workbook

        # 1. Set up explicitly ordered tab_order
        # Current Docs: Overview (0), Appendix (1).
        # We will add a document after Overview.
        tab_order = [
            {"type": "document", "index": 1},  # Appendix
            {"type": "sheet", "index": 0},  # Sheet 1
            {"type": "document", "index": 0},  # Overview
        ]
        editor.update_workbook_tab_order(tab_order)

        # 2. Add new document after Overview (index 0)
        # New doc becomes index 1. Appendix becomes index 2.
        result = editor.add_document("Middle Doc", after_doc_index=0)
        assert "error" not in result

        # 3. Verify tab_order updated
        state = json.loads(editor.get_state())
        new_tab_order = state["workbook"]["metadata"]["tab_order"]

        # Verify Appendix shift (was 1 -> now 2)
        appendix_entries = [
            item
            for item in new_tab_order
            if item["type"] == "document" and item["index"] == 2
        ]
        assert len(appendix_entries) > 0

        # Verify New Doc entry (index 1)
        new_entries = [
            item
            for item in new_tab_order
            if item["type"] == "document" and item["index"] == 1
        ]
        assert len(new_entries) > 0

    def test_add_document_with_insert_after_tab_order_index(
        self, setup_hybrid_workbook
    ):
        """Add document with explicit tab_order insertion point."""
        editor = setup_hybrid_workbook

        # Initial tab order: Doc(0) [Overview], Ind(0) [Sheet1], Doc(1) [Appendix]
        tab_order = [
            {"type": "document", "index": 0},
            {"type": "sheet", "index": 0},
            {"type": "document", "index": 1},
        ]
        editor.update_workbook_tab_order(tab_order)

        # Add "Inserted Doc" after the FIRST item in tab_order (Doc 0)
        # result: Doc(0), NewDoc(1), Sheet1, Appendix(2)
        result = editor.add_document(
            "Inserted Doc", after_doc_index=0, insert_after_tab_order_index=0
        )
        assert "error" not in result

        state = json.loads(editor.get_state())
        new_tab_order = state["workbook"]["metadata"]["tab_order"]
        assert len(new_tab_order) == 4
        # Index 0 was Doc 0.
        # Index 1 should be New Doc.
        assert new_tab_order[1]["type"] == "document"
        # The new doc index depends on where it was inserted in FILE structure.
        # after_doc_index=0 -> new doc is index 1.
        assert new_tab_order[1]["index"] == 1


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


class TestAddDocumentAndGetFullUpdate:
    """Tests for the atomic add_document_and_get_full_update function."""

    def test_add_document_atomic_update(self, setup_hybrid_workbook):
        """Verify that atomic add returns full consolidated update."""
        editor = setup_hybrid_workbook

        # Initial State:
        # Overview (Doc 0)
        # Workbook
        # Appendix (Doc 1)

        # Explicitly initialize tab order for this test to ensure robust verification
        # The default parser doesn't auto-generate document entries in tab_order on load
        initial_tab_order = [
            {"type": "document", "index": 0},
            {"type": "sheet", "index": 0},
            {"type": "document", "index": 1},
        ]
        editor.update_workbook_tab_order(initial_tab_order)

        # Add a new document in the middle
        result = editor.add_document_and_get_full_update(
            "Atomic Doc", after_doc_index=0
        )

        assert "error" not in result

        # Verify structure of return object
        assert "content" in result
        assert "workbook" in result
        assert "structure" in result

        # Verify content integrity
        content = result["content"]
        assert "# Atomic Doc" in content
        assert "# Overview" in content
        assert "# Appendix" in content

        # Verify metadata update is reflected in the single return payload
        tab_order = result["workbook"]["metadata"]["tab_order"]
        # Should have 4 items: Doc(0), New(1), Sheet(1), Appendix(2)
        # Note: Index check depends on exact setup_hybrid_workbook state
        # But we know Appendix index should have shifted

        doc_entries = [x for x in tab_order if x["type"] == "document"]
        assert len(doc_entries) == 3  # Overview, New, Appendix
