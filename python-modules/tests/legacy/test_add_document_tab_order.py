"""Tests for add_document tab_order insertion."""

import os
import sys

# Add the python-modules directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import headless_editor
from headless_editor import (
    add_document,
    generate_and_get_range,
    initialize_workbook,
)


class TestAddDocumentTabOrder:
    """Test that add_document correctly places new documents in tab_order."""

    def test_add_document_from_sheet1_in_4_sheet_workbook(self):
        """
        Reproduce EXACT user scenario:
        - 4 sheets in workbook
        - Right-click on Sheet 1 (tab index 1)
        - Add Document

        Initial tabs UI: [Sheet 0, Sheet 1, Sheet 2, Sheet 3, +]
        Initial tab_order: [sheet:0, sheet:1, sheet:2, sheet:3]

        User right-clicks Sheet 1 (index 1), thus:
        - targetTabOrderIndex = 1 + 1 = 2
        - insert_after_tab_order_index = 2 - 1 = 1 (TypeScript passes this)

        Expected: New Document appears at tab index 2 (between Sheet 1 and Sheet 2)
        Expected tab_order: [sheet:0, sheet:1, NEW_DOC, sheet:2, sheet:3]

        BUG: Document appears at tab index 4 (after all sheets, at Workbook end)
        """
        md_text = """# Tables

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

## Sheet 4

| A | B |
|---|---|
| 7 | 8 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}, {"type": "sheet", "index": 2}, {"type": "sheet", "index": 3}]} -->
"""
        initialize_workbook(md_text, '{"rootMarker": "# Tables"}')

        # Verify initial state
        initial_tab_order = headless_editor.workbook.metadata.get("tab_order", [])
        print(f"Initial tab_order: {initial_tab_order}")
        assert len(initial_tab_order) == 4, (
            f"Expected 4 items initially, got {len(initial_tab_order)}"
        )

        # Simulate: right-click on Sheet 1 (tab index 1), add Document
        # TypeScript _addDocumentFromMenu:
        #   targetTabOrderIndex = 1 + 1 = 2
        # TypeScript _addDocumentAtPosition(2):
        #   docsBeforeTarget = 0 (no documents)
        #   sheetsBeforeTarget = true
        #   afterWorkbook = true
        #   afterDocIndex = -1
        #   Calls: addDocument("...", -1, true, 2-1=1) <-- CURRENT CODE
        result = add_document(
            title="New Document",
            after_doc_index=-1,
            after_workbook=True,
            insert_after_tab_order_index=1,  # TypeScript passes targetTabOrderIndex - 1
        )

        assert result.get("file_changed"), f"Expected file_changed, got {result}"

        # Check workbook.metadata.tab_order AFTER add_document
        tab_order_after_add = headless_editor.workbook.metadata.get("tab_order", [])
        print(f"tab_order after add_document: {tab_order_after_add}")

        # Now simulate what spreadsheet-service.ts does: call generate_and_get_range()
        gen_result = generate_and_get_range()

        # Check tab_order AFTER generate_and_get_range
        final_tab_order = headless_editor.workbook.metadata.get("tab_order", [])
        print(f"Final tab_order after generate_and_get_range: {final_tab_order}")

        # Expected: [sheet:0, sheet:1, doc:0, sheet:2, sheet:3]
        # The new document should be at index 2 in tab_order list
        assert len(final_tab_order) == 5, (
            f"Expected 5 items in tab_order, got {len(final_tab_order)}"
        )

        # Position 2 should be the new document
        item_at_pos_2 = final_tab_order[2]
        print(f"Item at position 2: {item_at_pos_2}")

        assert item_at_pos_2["type"] == "document", (
            f"Position 2 should be document, got {item_at_pos_2}. "
            f"Full tab_order: {final_tab_order}"
        )
