from dataclasses import dataclass
from typing import Any, Dict, List

import pytest
from md_spreadsheet_editor.services.workbook import reorder_tab_metadata


@dataclass
class MockWorkbook:
    metadata: Dict[str, Any]


def test_reorder_logic_permutations():
    """
    Test moving an item from every position to every other position
    in a list of length N.
    """
    N = 5
    # Initial list: [0, 1, 2, 3, 4] representing indices

    # We simulate a "Workbook" where we have N items of type 'sheet'
    # and we want to reorder them using reorder_tab_metadata.

    for start_pos in range(N):
        for target_pos in range(N + 1):  # +1 because we can drop after last item
            # Setup
            # We use 'sheet' type for simplicity.
            # Initial order of indices: 0, 1, 2, 3, 4
            initial_tab_order = [{"type": "sheet", "index": i} for i in range(N)]

            wb = MockWorkbook(metadata={"tab_order": initial_tab_order})

            # Action: Move item at `start_pos` to `target_pos`.
            # Note: `reorder_tab_metadata` takes (from_idx, to_idx, target_tab_order_index).
            # Here from_idx (physical index) IS start_pos because we haven't shuffled yet.
            # to_idx (physical index) acts as "where it ends up in the index list".
            # BUT reorder_tab_metadata does 2 things:
            # 1. Remaps physical indices (0->1, 1->0 etc)
            # 2. Reorders the list.

            # To test purely the LIST REORDERING (which was the bug),
            # we need to understand what `target_tab_order_index` means.
            # It means "The visual gap index in the ORIGINAL list".

            # Expected Result:
            # If we move item 'A' (at start_pos) to 'target_pos'.
            # List: [0, 1, 2, 3, 4]
            # Remove 'A'.
            # Insert 'A' at 'target_pos' (adjusted).

            expected_list = list(range(N))
            item = expected_list.pop(start_pos)

            # Logic for expected insertion:
            # If target > start, it means we insert "after".
            # Since 'item' is removed, the indices shift.
            # If target <= start: insert at target.
            # If target > start: insert at target - 1.

            insert_idx = target_pos
            if target_pos > start_pos:
                insert_idx -= 1

            expected_list.insert(insert_idx, item)

            # Perform Action
            # We assume from_idx and to_idx for physical move are aligned with the list reorder for this test?
            # Actually, reorder_tab_metadata uses `from_idx` to generic "physical move".
            # If we just want to test list reordering, we can say from_idx=start_pos, to_idx=start_pos (no physical move?)
            # No, if to_idx == from_idx, it might skip reordering?
            # Let's check code: "if from_idx ... to_idx ... dummy_list ...".
            # If from==to, remapping is Identity.
            # But the 'moved_tab_order_item' logic still runs?
            # `if old_idx == from_idx: moved_tab_order_item = item`.
            # Yes. So we can set from_idx = to_idx = start_pos to isolate list shuffling.

            updated_wb = reorder_tab_metadata(
                wb,
                item_type="sheet",
                from_idx=start_pos,
                to_idx=start_pos,  # No physical index change
                target_tab_order_index=target_pos,
            )

            final_order = updated_wb.metadata["tab_order"]
            final_indices = [item["index"] for item in final_order]

            # Assert
            error_msg = f"Failed moving {start_pos} to {target_pos}. Expected {expected_list}, got {final_indices}"
            assert final_indices == expected_list, error_msg


def test_mixed_types_reorder():
    """
    Test reordering with mixed types (Documents and Sheets).
    This reproduces the specific User Bug scenario.
    """
    # [D0, D1, S0, S1, S2]
    # D0 move to after D1 (target 2).

    initial_tab_order = [
        {"type": "document", "index": 0},
        {"type": "document", "index": 1},
        {"type": "sheet", "index": 0},
        {"type": "sheet", "index": 1},
        {"type": "sheet", "index": 2},
    ]
    wb = MockWorkbook(metadata={"tab_order": initial_tab_order})

    # Move D0 (pos 0) to target 2.
    # We purposely DON'T change physical indices (to_idx=0) to isolate list logic,
    # OR we do change them (to_idx=1) to match reality.
    # Let's do full match: D0->1.

    updated_wb = reorder_tab_metadata(
        wb, item_type="document", from_idx=0, to_idx=1, target_tab_order_index=2
    )

    new_order = updated_wb.metadata["tab_order"]

    # Expected: D1(now 0), D0(now 1), S0, S1, S2
    # Types: D, D, S, S, S
    # Indices: 0, 1, 0, 1, 2

    assert new_order[0]["type"] == "document" and new_order[0]["index"] == 0
    assert new_order[1]["type"] == "document" and new_order[1]["index"] == 1
    assert new_order[2]["type"] == "sheet" and new_order[2]["index"] == 0
