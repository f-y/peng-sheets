"""
Tests for document operations: rename and delete.
"""

import pytest
from headless_editor import (
    add_document,
    delete_document,
    get_full_markdown,
    initialize_workbook,
    rename_document,
)


@pytest.fixture
def setup_multi_doc():
    md = """# Doc 1
Some content

# Doc 2
More content

# Doc 3
Last content
"""
    initialize_workbook(md, "{}")


class TestRenameDocument:
    def test_rename_document_simple(self, setup_multi_doc):
        """Test simple document renaming."""
        # Rename "Doc 2" to "Renamed Doc"
        result = rename_document(1, "Renamed Doc")
        assert "error" not in result

        md = get_full_markdown()
        assert "# Renamed Doc" in md
        assert "# Doc 2" not in md
        assert "More content" in md

    def test_rename_document_invalid_index(self, setup_multi_doc):
        """Test renaming with invalid index."""
        result = rename_document(99, "New Name")
        assert "error" in result
        assert "not found" in result["error"]

    def test_rename_workbook_root(self):
        """Test renaming a workbook root (should fail or work depending on logic)."""
        md = """# Root
## Sheet1
| A |
|---|
| 1 |
"""
        initialize_workbook(md, "{}")
        add_document("My Doc")

        result = rename_document(1, "Renamed Doc")
        assert "error" not in result

        md = get_full_markdown()
        assert "# Renamed Doc" in md


class TestDeleteDocument:
    def test_delete_document_middle(self, setup_multi_doc):
        """Test deleting a document in the middle."""
        result = delete_document(1)
        assert "error" not in result

        md = get_full_markdown()
        assert "# Doc 1" in md
        # The content should be removed
        assert "# Doc 2" not in md
        assert "# Doc 3" in md

    def test_delete_document_first(self, setup_multi_doc):
        """Test deleting the first document."""
        result = delete_document(0)
        assert "error" not in result

        md = get_full_markdown()
        assert "# Doc 1" not in md
        assert "# Doc 2" in md

    def test_delete_document_invalid_index(self, setup_multi_doc):
        """Test deleting with invalid index."""
        result = delete_document(99)
        assert "error" in result


class TestDeleteDocumentWithMetadata:
    def test_delete_document_updates_tab_order(self):
        """Test that deleting a document updates tab_order metadata."""
        md = """# Tables
## Sheet 1
| A |
|---|
| 1 |

# Doc 1
Some content

# Doc 2
More content

# Doc 3
Even more content
"""
        import json

        from headless_editor import get_state, update_workbook_tab_order

        initialize_workbook(md, "{}")

        # Manually set tab_order
        # Include 3 documents to test shift logic
        tab_order = [
            {"type": "sheet", "index": 0},
            {"type": "document", "index": 0},
            {"type": "document", "index": 1},
            {"type": "document", "index": 2},
        ]
        update_workbook_tab_order(tab_order)

        # Delete Doc 2 (index 1) - Middle document
        # This should trigger:
        # - Doc 1 (index 0): Preserved (index < deleted)
        # - Doc 3 (index 2): Shifted (index > deleted) -> index 1
        delete_document(1)

        state = json.loads(get_state())
        wb_meta = state["workbook"]["metadata"]
        new_tab_order = wb_meta["tab_order"]

        assert len(new_tab_order) == 3

        # Verify Doc entries
        doc_entries = [x for x in new_tab_order if x["type"] == "document"]
        assert len(doc_entries) == 2

        # Sort to verify specific indices
        doc_entries.sort(key=lambda x: x["index"])

        # Doc 1 should still be 0
        assert doc_entries[0]["index"] == 0

        # Doc 3 should now be 1 (shifted from 2)
        assert doc_entries[1]["index"] == 1
