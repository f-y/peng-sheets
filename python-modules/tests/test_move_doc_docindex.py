"""Tests for move_document_section docIndex recalculation."""

import os
import sys

# Add the python-modules directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import headless_editor
from headless_editor import (
    initialize_workbook,
    move_document_section,
)


class TestMoveDocumentSectionDocIndexRecalc:
    """Test that docIndex is correctly recalculated after physical Document moves."""

    def test_move_doc_to_front_updates_docindex(self):
        """
        When Document 2 moves to position 0, docIndex values should update:
        - Document 2: from index 1 -> index 0
        - Document 1: from index 0 -> index 1

        Initial: [Doc1(0), Workbook, Doc2(1)]
        Final:   [Doc2(0), Workbook, Doc1(1)]
        tab_order should have index values updated accordingly.
        """
        md_text = """# Document 1
Some content.

# Tables
## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->

# Document 2
More content.
"""
        config = '{"rootMarker": "# Tables"}'
        initialize_workbook(md_text, config)

        # Move Document 2 (from_doc_index=1) to before Workbook (index 0 in docs)
        # With target_tab_order_index=0 (move to front of UI tabs)
        result = move_document_section(
            from_doc_index=1,
            to_doc_index=0,  # Move before Document 1
            target_tab_order_index=0,
        )

        assert result.get("file_changed") == True, (
            f"Expected file_changed=True, got {result}"
        )

        # Check metadata - docIndex should be recalculated
        metadata = headless_editor.workbook.metadata
        tab_order = metadata.get("tab_order", [])

        # Find document items in tab_order
        doc_items = [item for item in tab_order if item["type"] == "document"]

        # After move, former Document 2 should have index 0
        # and former Document 1 should have index 1
        doc_indices = sorted([(item["index"]) for item in doc_items])
        assert doc_indices == [0, 1], f"Expected doc indices [0, 1], got {doc_indices}"

        # The first item in tab_order should be the moved document (now at index 0)
        assert tab_order[0]["type"] == "document", (
            f"First tab should be document, got {tab_order[0]}"
        )
        assert tab_order[0]["index"] == 0, (
            f"First doc should have index 0, got {tab_order[0]['index']}"
        )

    def test_move_doc_before_workbook_updates_docindex(self):
        """
        When Document 2 moves before Workbook (using to_before_workbook=True),
        docIndex values should update correctly.

        Initial: [Doc1(0), Workbook, Doc2(1)]
        Move: Doc2 to before Workbook
        Final: [Doc1(0), Doc2(1-becomes-0-in-new-order?), Workbook, ...]

        Wait, to_before_workbook should put doc2 right before workbook.
        If doc1 is already before workbook, this means doc2 goes between doc1 and workbook.
        So file order becomes: [Doc1, Doc2, Workbook] and indices should be Doc1=0, Doc2=1.

        Actually just testing that move_document_section handles to_before_workbook correctly.
        """
        md_text = """# Document 1
Content 1.

# Tables
## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->

# Document 2
Content 2.
"""
        config = '{"rootMarker": "# Tables"}'
        initialize_workbook(md_text, config)

        # Move Document 2 to before Workbook
        result = move_document_section(
            from_doc_index=1,
            to_doc_index=None,
            to_before_workbook=True,
            target_tab_order_index=1,  # Place after Doc1 in UI but before Sheet
        )

        assert result.get("file_changed") == True, (
            f"Expected file_changed=True, got {result}"
        )

        # Check metadata
        metadata = headless_editor.workbook.metadata
        tab_order = metadata.get("tab_order", [])

        # The docIndex values should reflect new physical order
        doc_items = [item for item in tab_order if item["type"] == "document"]
        doc_indices = [item["index"] for item in doc_items]

        # Both docs should have valid indices (0 and 1 in some order)
        assert 0 in doc_indices, f"Expected index 0 in doc_indices, got {doc_indices}"
        assert 1 in doc_indices, f"Expected index 1 in doc_indices, got {doc_indices}"

    def test_physical_move_doc1_after_doc2(self):
        """
        When Document 1 is moved after Document 2, indices should swap.

        Initial file order: [Doc1, Workbook, Doc2]
        After move (Doc1 -> after Workbook): [Workbook, Doc2, Doc1] or [Workbook, Doc1, Doc2]

        Indices should be recalculated based on new file order.
        """
        md_text = """# Document 1
Content 1.

# Tables
## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "document", "index": 1}]} -->

# Document 2
Content 2.
"""
        config = '{"rootMarker": "# Tables"}'
        initialize_workbook(md_text, config)

        # Move Document 1 (index 0) to after Document 2 (index 1)
        result = move_document_section(
            from_doc_index=0,
            to_doc_index=2,  # After last doc (becomes position 1 after removal)
            target_tab_order_index=2,  # Move in UI (after sheet, doc2)
        )

        assert result.get("file_changed") == True, (
            f"Expected file_changed=True, got {result}"
        )

        # Check that indices are recalculated
        metadata = headless_editor.workbook.metadata
        tab_order = metadata.get("tab_order", [])

        doc_items = [item for item in tab_order if item["type"] == "document"]

        # After move, original Doc1 should be at index 1, original Doc2 at index 0
        # Because file order becomes: [Workbook, Doc2, Doc1]
        # So Doc2's index becomes 0, Doc1's index becomes 1
        for item in doc_items:
            assert item["index"] in [0, 1], f"Invalid doc index: {item['index']}"

    def test_move_doc_index1_to_tab_position_0(self):
        """
        Reproduces exact user scenario:

        Initial tab_order:
        [{"type": "sheet", "index": 0}, {"type": "document", "index": 0},
         {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2},
         {"type": "document", "index": 1}, ...]

        User moves Document index=1 to Tab position 0.
        The document should physically move to before Workbook in the file.

        Expected AFTER move:
        1. Document that was index=1 should now have index=0 (it's first in file)
        2. Document that was index=0 should now have index=1
        3. The tab_order list should be REORDERED so that the moved document is FIRST

        Actual bug: docIndex fixed, but tab_order list order is wrong (Sheet still first)
        """
        md_text = """# Document 1

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| A | B |
|---|---|
| 3 | 4 |

## Sheet 3

| A | B |
|---|---|
| 5 | 6 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "document", "index": 0}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2}, {"type": "document", "index": 1}]} -->

# Document 2
Content 2.
"""
        config = '{"rootMarker": "# Tables"}'
        initialize_workbook(md_text, config)

        # Move Document 2 (index=1) to Tab position 0 (before workbook)
        # This is what happens when user drags Document 2 to the leftmost position
        result = move_document_section(
            from_doc_index=1,  # Document 2
            to_doc_index=None,
            to_before_workbook=True,  # Move to before Workbook
            target_tab_order_index=0,  # Tab position 0 - should be FIRST in list
        )

        assert result.get("file_changed"), f"Expected file_changed, got {result}"

        # Check metadata
        metadata = headless_editor.workbook.metadata
        tab_order = metadata.get("tab_order", [])

        # CRITICAL TEST 1: The FIRST item in tab_order should be the moved document
        # (not just have index=0, but be at position [0] in the list)
        assert tab_order[0]["type"] == "document", (
            f"First tab should be document (moved to position 0), got {tab_order[0]}"
        )

        # CRITICAL TEST 2: The moved document (now physically first) should have index=0
        assert tab_order[0]["index"] == 0, (
            f"Moved document should have index 0 in file, got {tab_order[0]['index']}"
        )

        # Find all document items
        doc_items = [item for item in tab_order if item["type"] == "document"]
        doc_indices = [item["index"] for item in doc_items]

        # Both should be valid: 0 and 1
        assert sorted(doc_indices) == [0, 1], (
            f"Expected doc indices [0, 1], got sorted: {sorted(doc_indices)}"
        )

    def test_move_doc_to_before_workbook_with_existing_doc(self):
        """
        Reproduce user scenario: Document 2 moves to between Document 1 and Sheet 1.

        Before file: [Document 1, Workbook, Document 2, Document 3, Document 4]
        Before tab_order: [doc:0, sheet:0, sheet:1, sheet:2, doc:1, doc:2, doc:3]

        Action: Move Document 2 to between Document 1 and Sheet 1

        After file: [Document 1, Document 2, Workbook, Document 3, Document 4]
        Expected tab_order: [doc:0, doc:1, sheet:0, sheet:1, sheet:2, doc:2, doc:3]

        Bug: tab_order was [doc:1, doc:0, ...] instead of [doc:0, doc:1, ...]
        """
        md_text = """# Document 1

# Tables

## Sheet 1

### Table 1

| A | B | C |
| --- | --- | --- |
|  |  |  |

## Sheet 2

| A | B |
|---|---|
| 1 | 2 |

## Sheet 3

| A | B |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2}, {"type": "document", "index": 1}, {"type": "document", "index": 2}, {"type": "document", "index": 3}]} -->


# Document 2

# Document 3

# Document 4

"""
        initialize_workbook(md_text, '{"rootMarker": "# Tables"}')

        # Move Document 2 (docIndex=1) to position between Document 1 and Sheet 1
        # This is target_tab_order_index=1 (after doc:0, before sheet:0)
        result = move_document_section(
            from_doc_index=1,  # Document 2
            to_doc_index=None,
            to_before_workbook=True,
            target_tab_order_index=1,  # Insert at position 1 in tab_order
        )

        assert result.get("file_changed"), "File should have changed"

        # Check file order: Document 2 should be before Workbook
        content = result["content"]
        assert content.index("# Document 2") < content.index("# Tables"), (
            "Document 2 should be before Workbook in file"
        )
        assert content.index("# Document 1") < content.index("# Document 2"), (
            "Document 1 should still be before Document 2"
        )

        # Check tab_order
        tab_order = headless_editor.workbook.metadata.get("tab_order", [])

        # First two items should be documents with indices 0 and 1 (in order)
        assert tab_order[0]["type"] == "document", (
            f"First item should be document, got {tab_order[0]}"
        )
        assert tab_order[1]["type"] == "document", (
            f"Second item should be document, got {tab_order[1]}"
        )

        # Critical assertion: Document indices should be 0, 1 (not 1, 0)
        assert tab_order[0]["index"] == 0, (
            f"First document should have index 0 (Document 1), got {tab_order[0]['index']}"
        )
        assert tab_order[1]["index"] == 1, (
            f"Second document should have index 1 (Document 2), got {tab_order[1]['index']}"
        )


class TestMoveWorkbookSectionTabOrder:
    """Test that tab_order is correctly reordered after Workbook moves."""

    def test_move_workbook_before_document_reorders_tab_order(self):
        """
        When Workbook moves before Document 1, tab_order should be reordered.

        File structure: [Document 1, Workbook (Sheet 1, Sheet 2), Document 2]
        Initial tab_order: [Document 0, Sheet 0, Sheet 1, Document 1]

        Action: Move Workbook to before Document 0 (position 0)
        Expected tab_order: [Sheet 0, Sheet 1, Document 0, Document 1]
        (Sheets come first, then Documents with updated indices)
        """
        md_text = """# Document 1
First doc.

# Tables
## Sheet 1
| A | B |
|---|---|
| 1 | 2 |

## Sheet 2
| A | B |
|---|---|
| 3 | 4 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "document", "index": 1}]} -->

# Document 2
Second doc.
"""
        initialize_workbook(md_text, '{"rootMarker": "# Tables"}')

        from headless_editor import move_workbook_section

        # Move Workbook to before Document 0
        result = move_workbook_section(
            to_doc_index=0, to_after_doc=False, target_tab_order_index=0
        )

        assert result["file_changed"], "File should have changed"

        # Check that Workbook is now first in the file
        content = result["content"]
        assert content.index("# Tables") < content.index("# Document 1"), (
            "Workbook should be before Document 1 in file"
        )

        # Check tab_order is correctly reordered
        tab_order = headless_editor.workbook.metadata.get("tab_order", [])

        # First item should be a sheet (Workbook is first in file and tab_order)
        assert tab_order[0]["type"] == "sheet", (
            f"First item in tab_order should be sheet, got {tab_order[0]}"
        )
