import json
import os
import sys

import pytest

sys.path.append(os.path.join(os.path.dirname(__file__), ".."))
from headless_editor import (
    add_sheet,
    add_table,
    get_state,
    initialize_workbook,
    sort_rows,
    update_cell,
    update_visual_metadata,
)


def get_row_values(state, sheet_idx=0, table_idx=0, col_idx=0):
    wb = state["workbook"]
    rows = wb["sheets"][sheet_idx]["tables"][table_idx]["rows"]
    return [r[col_idx] for r in rows]


def test_smart_sort_heuristic_numeric():
    # Setup: 1, 10, 2 (Numeric Heuristic)
    initialize_workbook("# Tables", "{}")
    add_sheet("Sheet1")
    add_table(0)
    # Default 3 cols, 1 row. Add more rows.
    # We need 3 rows.
    # Current: 1 row.
    # Add rows manually or just update cell 0,0 then paste?
    # Let's use paste for quick setup or just update cells if we have rows.
    # insert_row is available.
    from headless_editor import insert_row

    insert_row(0, 0, 1)  # row 2
    insert_row(0, 0, 2)  # row 3

    # Set values: 1, 10, 2
    update_cell(0, 0, 0, 0, "1")
    update_cell(0, 0, 1, 0, "10")
    update_cell(0, 0, 2, 0, "2")

    # Sort Ascending
    sort_rows(0, 0, 0, True)

    state = json.loads(get_state())
    values = get_row_values(state)
    assert values == ["1", "2", "10"]

    # Sort Descending
    sort_rows(0, 0, 0, False)
    state = json.loads(get_state())
    values = get_row_values(state)
    assert values == ["10", "2", "1"]


def test_smart_sort_commas():
    initialize_workbook("# Tables", "{}")
    add_sheet("Sheet1")
    add_table(0)
    from headless_editor import insert_row

    insert_row(0, 0, 1)
    insert_row(0, 0, 2)

    # "1,000", "200", "50"
    update_cell(0, 0, 0, 0, "1,000")
    update_cell(0, 0, 1, 0, "200")
    update_cell(0, 0, 2, 0, "50")

    # Sort Ascending
    sort_rows(0, 0, 0, True)

    state = json.loads(get_state())
    values = get_row_values(state)
    # 50, 200, 1,000
    assert values == ["50", "200", "1,000"]


def test_metadata_override_force_string():
    # ID column where we want string sort: "10", "2" -> "10", "2" (asc)
    initialize_workbook("# Tables", "{}")
    add_sheet("Sheet1")
    add_table(0)
    from headless_editor import insert_row

    insert_row(0, 0, 1)

    update_cell(0, 0, 0, 0, "10")
    update_cell(0, 0, 1, 0, "2")

    # Normal would be 2, 10.
    # Force string type via metadata.
    # visual: { columns: { "0": { "type": "string" } } }
    # Note: Our update_visual_metadata deeply merges 'visual'.
    # But usually it expects flat keys like 'filters'.
    # We need to manually inject or use a helper if available, or just update_visual_metadata if it supports arbitrary?
    # update_visual_metadata merges dict passed.

    meta = {"columns": {"0": {"type": "string"}}}
    update_visual_metadata(0, 0, meta)

    sort_rows(0, 0, 0, True)

    state = json.loads(get_state())
    values = get_row_values(state)
    # String sort: "10" comes before "2" because '1' < '2'
    assert values == ["10", "2"]


def test_mixed_fallback_to_string():
    # "1", "A", "2" -> Should resort to string sort logic
    initialize_workbook("# Tables", "{}")
    add_sheet("Sheet1")
    add_table(0)
    from headless_editor import insert_row

    insert_row(0, 0, 1)
    insert_row(0, 0, 2)

    update_cell(0, 0, 0, 0, "1")
    update_cell(0, 0, 1, 0, "A")
    update_cell(0, 0, 2, 0, "2")

    sort_rows(0, 0, 0, True)

    state = json.loads(get_state())
    values = get_row_values(state)
    # String sort: "1", "2", "a" (case insensitive usually?) or "1", "A", "2" -> "1", "2", "a"?
    # '1' < '2' < 'a'
    # "1", "2", "A"
    assert values == ["1", "2", "A"]
