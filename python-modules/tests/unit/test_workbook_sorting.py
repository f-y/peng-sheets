from dataclasses import replace

from md_spreadsheet_editor.services.workbook import reorder_tab_metadata
from md_spreadsheet_parser import Workbook


def test_reorder_tab_metadata_scenario():
    # Setup initial state matching user scenario
    # Tab Order: D0, D1, S0, S1, S2
    # Indices in list: 0, 1, 2, 3, 4

    initial_metadata = {
        "tab_order": [
            {"type": "document", "index": 0},  # D0
            {"type": "document", "index": 1},  # D1
            {"type": "sheet", "index": 0},  # S0
            {"type": "sheet", "index": 1},  # S1
            {"type": "sheet", "index": 2},  # S2
        ]
    }

    wb = Workbook(sheets=[], metadata=initial_metadata)

    # Action: Move D0 (Index 0) to "After D1" (Index 1).
    # Target Tab Order Index provided by UI seems to be '2' (After D1).
    # Why 2?
    # Index 0 is D0. Index 1 is D1. Gap after D1 is 2.

    from_doc_index = 0
    to_doc_index = 1
    target_tab_order_index = 2

    updated_wb = reorder_tab_metadata(
        wb,
        item_type="document",
        from_idx=from_doc_index,
        to_idx=to_doc_index,
        target_tab_order_index=target_tab_order_index,
    )

    new_order = updated_wb.metadata["tab_order"]

    # Expected Result:
    # Physical indices flipped: D0->1, D1->0. S unchanged.
    # List order: D1(0), D0(1), S0, S1, S2

    expected_order = [
        {"type": "document", "index": 0},  # D1 (now 0)
        {"type": "document", "index": 1},  # D0 (now 1)
        {"type": "sheet", "index": 0},
        {"type": "sheet", "index": 1},
        {"type": "sheet", "index": 2},
    ]

    # Verify exact match
    # Use assertion to see diff
    assert new_order == expected_order


def test_reorder_tab_metadata_defensive():
    """Test defensive checks in reorder_tab_metadata (coverage paths)."""
    wb = Workbook(sheets=[])

    # 1. No metadata
    res = reorder_tab_metadata(wb, "sheet", 0, 1, 0)
    assert res == wb

    # 2. Empty metadata
    wb = replace(wb, metadata={})
    res = reorder_tab_metadata(wb, "sheet", 0, 1, 0)
    assert res == wb

    # 3. Empty tab_order
    wb = replace(wb, metadata={"tab_order": []})
    res = reorder_tab_metadata(wb, "sheet", 0, 1, 0)
    assert res == wb

    # 4. No matching items in tab_order
    wb = replace(wb, metadata={"tab_order": [{"type": "document", "index": 0}]})
    res = reorder_tab_metadata(wb, "sheet", 0, 1, 0)
    assert res == wb

    # 5. target_tab_order_index is None (Should execute reindex but skip list move)
    # Setup: S0, S1. Move S0->1.
    initial = [{"type": "sheet", "index": 0}, {"type": "sheet", "index": 1}]
    wb = replace(wb, metadata={"tab_order": list(initial)})

    res = reorder_tab_metadata(wb, "sheet", 0, 1, target_tab_order_index=None)
    new_order = res.metadata["tab_order"]

    # Indices should flip: S0->1, S1->0
    expected = [{"type": "sheet", "index": 1}, {"type": "sheet", "index": 0}]
    assert new_order == expected
    # But ORDER in list should remain exact same (S0 first then S1)
    # Wait, 'expected' above implies order.
    # Logic:
    # item 0 (S0) -> index 1.
    # item 1 (S1) -> index 0.
    # List order is NOT changed if target_tab_order_index is None.
    # So new_order[0] is S0(which now has index 1).
    assert new_order[0]["index"] == 1
    assert new_order[1]["index"] == 0
