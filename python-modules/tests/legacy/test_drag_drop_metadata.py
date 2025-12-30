import json

import headless_editor
import pytest

# Workbook with 2 Docs and 2 Sheets
# Structure:
# - Doc A (index 0)
# - Workbook Root
#   - Sheet 1 (index 0)
#   - Sheet 2 (index 1)
# - Doc B (index 1)
CONTENT = """# Doc A

## Subheader

# Tables


## Sheet 1

| A | B |
|---|---|
| 1 | 2 |

## Sheet 2

| C | D |
|---|---|
| 3 | 4 |

# Doc B

End.
"""


@pytest.fixture
def editor():
    headless_editor.initialize_workbook(CONTENT, "{}")

    # Initialize tab_order programmatically to avoid parser issues in test
    initial_tab_order = [
        {"type": "document", "index": 0},
        {"type": "sheet", "index": 0},
        {"type": "sheet", "index": 1},
        {"type": "document", "index": 1},
    ]
    headless_editor.update_workbook_tab_order(initial_tab_order)

    return headless_editor


def test_move_sheet_updates_metadata(editor):
    # Move Sheet 1 (index 0) to after Sheet 2 (to index 1)
    # Target tab order index:
    # Current tab_order: [Doc0, Sheet0, Sheet1, Doc1]
    # We want to move Sheet0 to AFTER Sheet1.
    # New tab_order should be: [Doc0, Sheet1, Sheet0, Doc1]
    # Target index in tab_order list: 3 (After Sheet 1)
    # move_sheet(from=0, to=1, target=3)

    result = editor.move_sheet(0, 1, target_tab_order_index=3)

    assert "error" not in result

    state = json.loads(editor.get_state())
    tab_order = state["workbook"]["metadata"]["tab_order"]

    # Expected: [Doc0, Sheet1, Sheet0, Doc1]
    # Note: Sheet indices should be updated based on physical move.
    # Sheet 0 moved to 1. Sheet 1 moved to 0.
    # So "Sheet0" in tab_order becomes "Sheet1" physically? No.
    # The item representing the moved sheet should now have new index.

    # move_sheet(0, 1):
    # Old Sheet 0 (value A) -> New Index 1.
    # Old Sheet 1 (value B) -> New Index 0.

    # Original tab_order:
    # 0: Doc 0
    # 1: Sheet 0 (A) -> Becomes Sheet index 1
    # 2: Sheet 1 (B) -> Becomes Sheet index 0
    # 3: Doc 1

    # If we apply index updates only:
    # 0: Doc 0
    # 1: Sheet 1 (A moved)
    # 2: Sheet 0 (B moved)
    # 3: Doc 1

    # If we ALSO move list item from 1 to 2:
    # 0: Doc 0
    # 1: Sheet 0 (B) (was at 2, stayed at 2 but list item moved? No)
    # List move: pop at 1, insert at 2.
    # [Doc0, Sheet1(B), Sheet1(A), Doc1] ??

    # Let's trace logic:
    # 1. Update indices map:
    #    Old 0 -> New 1
    #    Old 1 -> New 0
    #    item at index 1 (old 0): type=sheet, index=0 -> new index=1
    #    item at index 2 (old 1): type=sheet, index=1 -> new index=0
    # Result of step 1:
    # [Doc0, Sheet(idx=1), Sheet(idx=0), Doc1]

    # 2. Reorder list:
    #    Identify moved item: Old index was 0 (from_idx).
    #    It's the item that NOW has index 1 (the 2nd item in list).
    #    Pop it (list index 1).
    #    List: [Doc0, Sheet(idx=0), Doc1]
    #    Insert at target (2).
    #    List: [Doc0, Sheet(idx=0), Sheet(idx=1), Doc1]

    # Wait, my expected result was [Doc0, Sheet1, Sheet0, Doc1] ?
    # Visual order: Doc0, Sheet B, Sheet A, Doc1.
    # Sheet B is index 0. Sheet A is index 1.
    # So [Doc0, Sheet(idx=0), Sheet(idx=1), Doc1] IS correct.

    item0 = tab_order[0]
    item1 = tab_order[1]
    item2 = tab_order[2]
    item3 = tab_order[3]

    assert item0["type"] == "document" and item0["index"] == 0
    assert item1["type"] == "sheet" and item1["index"] == 0
    assert item2["type"] == "sheet" and item2["index"] == 1
    assert item3["type"] == "document" and item3["index"] == 1


def test_move_document_updates_metadata(editor):
    # Move Doc A (index 0) to after Doc B (to update index 1)
    # Current tab_order: [Doc0, Sheet0, Sheet1, Doc1]
    # Move Doc0 to 1.
    # Target tab order: [Sheet0, Sheet1, Doc1, Doc0] ... maybe?
    # If we drag Doc A to the end.
    # Target list index: 4 (Append)

    result = editor.move_document_section(0, 1, target_tab_order_index=4)

    assert "error" not in result

    state = json.loads(editor.get_state())
    tab_order = state["workbook"]["metadata"]["tab_order"]

    # Index updates:
    # Doc 0 -> 1
    # Doc 1 -> 0

    # List update:
    # Move original Doc 0 item to index 3.

    # Step 1 (Index update):
    # [Doc(1), Sheet0, Sheet1, Doc(0)] (indices updated)

    # Step 2 (List move):
    # Pop item representing old Doc 0. (It's at index 0).
    # List: [Sheet0, Sheet1, Doc(0)]
    # Insert at 3.
    # List: [Sheet0, Sheet1, Doc(0), Doc(1 from Step1->moved item)]

    # Wait, which item was moved?
    # old_idx = 0.
    # Item at list index 0 was Doc(0). It became Doc(1).
    # Item at list index 3 was Doc(1). It became Doc(0).

    # Verify:
    # Old tab_order: [D0, S0, S1, D1]
    # Map: 0->1, 1->0 for docs.
    # D0 becomes D1.
    # D1 becomes D0.
    # tab_order after map: [D1, S0, S1, D0].

    # Move item that was D0 (now D1). It is at list pos 0.
    # Pop(0). -> [S0, S1, D0]. Item=D1.
    # Insert at 3. -> [S0, S1, D0, D1].

    # Correct.

    expected = [
        {"type": "sheet", "index": 0},
        {"type": "sheet", "index": 1},
        {"type": "document", "index": 0},
        {"type": "document", "index": 1},
    ]

    # Iterate and check
    for i, exp in enumerate(expected):
        assert tab_order[i]["type"] == exp["type"]
        assert tab_order[i]["index"] == exp["index"]
