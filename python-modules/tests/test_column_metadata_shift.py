"""
Tests for column metadata index shifting on insert/delete operations.

Ensures that column-indexed metadata (column_widths, validation, columns, filters)
is properly shifted when columns are inserted or deleted.
"""

import json

from headless_editor import (
    _shift_column_metadata_indices,
    delete_column,
    get_state,
    initialize_workbook,
    insert_column,
    update_visual_metadata,
)


def setup_workbook_with_metadata():
    """
    Create a workbook with column-indexed metadata for testing.
    Sets up metadata for columns 0, 1, 2, 3.
    """
    md = """# Tables
## Sheet1
| A | B | C | D |
|---|---|---|---|
| 1 | 2 | 3 | 4 |
"""
    initialize_workbook(md, "{}")

    # Set up visual metadata with column-indexed entries
    visual_metadata = {
        "column_widths": {
            "0": 100,
            "1": 150,
            "2": 200,
            "3": 250,
        },
        "validation": {
            "0": {"type": "integer", "min": 0, "max": 100},
            "1": {"type": "list", "values": ["A", "B", "C"]},
            "2": {"type": "date"},
            "3": {"type": "email"},
        },
        "columns": {
            "0": {"format": "number", "decimals": 2},
            "1": {"format": "text"},
            "2": {"format": "date"},
            "3": {"format": "currency"},
        },
        "filters": {
            "0": ["hidden1"],
            "1": ["hidden2", "hidden3"],
            "2": [],
            "3": ["hidden4"],
        },
    }
    update_visual_metadata(0, 0, visual_metadata)


def get_visual_metadata():
    """Helper to get the visual metadata from current state."""
    state = json.loads(get_state())
    table = state["workbook"]["sheets"][0]["tables"][0]
    return table.get("metadata", {}).get("visual", {})


# ============================================================================
# INSERT COLUMN TESTS
# ============================================================================


class TestInsertColumnMetadataShift:
    """Tests for metadata shifting when inserting columns."""

    def test_insert_column_at_start_shifts_all_indices(self):
        """Inserting column at index 0 should shift all metadata indices by +1."""
        setup_workbook_with_metadata()

        # Insert column at index 0
        result = insert_column(0, 0, 0)
        assert "error" not in result

        visual = get_visual_metadata()

        # Original column 0 should now be at index 1
        assert visual["column_widths"]["1"] == 100
        assert visual["validation"]["1"]["type"] == "integer"
        assert visual["columns"]["1"]["format"] == "number"
        assert visual["filters"]["1"] == ["hidden1"]

        # Original column 1 should now be at index 2
        assert visual["column_widths"]["2"] == 150
        assert visual["validation"]["2"]["type"] == "list"
        assert visual["columns"]["2"]["format"] == "text"
        assert visual["filters"]["2"] == ["hidden2", "hidden3"]

        # Original column 3 should now be at index 4
        assert visual["column_widths"]["4"] == 250
        assert visual["validation"]["4"]["type"] == "email"
        assert visual["columns"]["4"]["format"] == "currency"
        assert visual["filters"]["4"] == ["hidden4"]

        # No metadata at index 0 (the new column)
        assert "0" not in visual["column_widths"]
        assert "0" not in visual["validation"]
        assert "0" not in visual["columns"]
        assert "0" not in visual["filters"]

    def test_insert_column_in_middle_shifts_only_subsequent(self):
        """Inserting column at index 2 should only shift indices >= 2."""
        setup_workbook_with_metadata()

        # Insert column at index 2
        result = insert_column(0, 0, 2)
        assert "error" not in result

        visual = get_visual_metadata()

        # Columns 0 and 1 should remain unchanged
        assert visual["column_widths"]["0"] == 100
        assert visual["column_widths"]["1"] == 150
        assert visual["validation"]["0"]["type"] == "integer"
        assert visual["validation"]["1"]["type"] == "list"

        # Original column 2 should now be at index 3
        assert visual["column_widths"]["3"] == 200
        assert visual["validation"]["3"]["type"] == "date"
        assert visual["columns"]["3"]["format"] == "date"

        # Original column 3 should now be at index 4
        assert visual["column_widths"]["4"] == 250
        assert visual["validation"]["4"]["type"] == "email"

        # No metadata at index 2 (the new column)
        assert "2" not in visual["column_widths"]
        assert "2" not in visual["validation"]

    def test_insert_column_at_end_shifts_nothing(self):
        """Inserting column at the end should not shift any existing indices."""
        setup_workbook_with_metadata()

        # Insert column at index 4 (end)
        result = insert_column(0, 0, 4)
        assert "error" not in result

        visual = get_visual_metadata()

        # All original columns should remain at their indices
        assert visual["column_widths"]["0"] == 100
        assert visual["column_widths"]["1"] == 150
        assert visual["column_widths"]["2"] == 200
        assert visual["column_widths"]["3"] == 250
        assert visual["validation"]["0"]["type"] == "integer"
        assert visual["validation"]["1"]["type"] == "list"
        assert visual["validation"]["2"]["type"] == "date"
        assert visual["validation"]["3"]["type"] == "email"


# ============================================================================
# DELETE COLUMN TESTS
# ============================================================================


class TestDeleteColumnMetadataShift:
    """Tests for metadata shifting when deleting columns."""

    def test_delete_column_at_start_shifts_all_indices(self):
        """Deleting column at index 0 should shift all subsequent indices by -1."""
        setup_workbook_with_metadata()

        # Delete column at index 0
        result = delete_column(0, 0, 0)
        assert "error" not in result

        visual = get_visual_metadata()

        # Original column 1 should now be at index 0
        assert visual["column_widths"]["0"] == 150
        assert visual["validation"]["0"]["type"] == "list"
        assert visual["columns"]["0"]["format"] == "text"
        assert visual["filters"]["0"] == ["hidden2", "hidden3"]

        # Original column 2 should now be at index 1
        assert visual["column_widths"]["1"] == 200
        assert visual["validation"]["1"]["type"] == "date"

        # Original column 3 should now be at index 2
        assert visual["column_widths"]["2"] == 250
        assert visual["validation"]["2"]["type"] == "email"

        # No metadata at index 3 (deleted)
        assert "3" not in visual["column_widths"]
        assert "3" not in visual["validation"]

    def test_delete_column_in_middle_shifts_only_subsequent(self):
        """Deleting column at index 1 should only shift indices > 1."""
        setup_workbook_with_metadata()

        # Delete column at index 1
        result = delete_column(0, 0, 1)
        assert "error" not in result

        visual = get_visual_metadata()

        # Column 0 should remain unchanged
        assert visual["column_widths"]["0"] == 100
        assert visual["validation"]["0"]["type"] == "integer"

        # Original column 2 should now be at index 1
        assert visual["column_widths"]["1"] == 200
        assert visual["validation"]["1"]["type"] == "date"

        # Original column 3 should now be at index 2
        assert visual["column_widths"]["2"] == 250
        assert visual["validation"]["2"]["type"] == "email"

        # No metadata at index 3
        assert "3" not in visual["column_widths"]
        assert "3" not in visual["validation"]

    def test_delete_column_at_end_removes_only_that_index(self):
        """Deleting the last column should only remove its metadata."""
        setup_workbook_with_metadata()

        # Delete column at index 3 (last)
        result = delete_column(0, 0, 3)
        assert "error" not in result

        visual = get_visual_metadata()

        # Columns 0, 1, 2 should remain unchanged
        assert visual["column_widths"]["0"] == 100
        assert visual["column_widths"]["1"] == 150
        assert visual["column_widths"]["2"] == 200
        assert visual["validation"]["0"]["type"] == "integer"
        assert visual["validation"]["1"]["type"] == "list"
        assert visual["validation"]["2"]["type"] == "date"

        # No metadata at index 3 (deleted)
        assert "3" not in visual["column_widths"]
        assert "3" not in visual["validation"]
        assert "3" not in visual["columns"]
        assert "3" not in visual["filters"]


# ============================================================================
# EDGE CASE TESTS
# ============================================================================


class TestMetadataShiftEdgeCases:
    """Edge case tests for metadata shifting."""

    def test_insert_with_no_metadata(self):
        """Insert column with no visual metadata should not error."""
        md = """# Tables
## Sheet1
| A | B |
|---|---|
| 1 | 2 |
"""
        initialize_workbook(md, "{}")

        result = insert_column(0, 0, 0)
        assert "error" not in result

        # Should have 3 columns now
        state = json.loads(get_state())
        headers = state["workbook"]["sheets"][0]["tables"][0]["headers"]
        assert len(headers) == 3

    def test_delete_with_no_metadata(self):
        """Delete column with no visual metadata should not error."""
        md = """# Tables
## Sheet1
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
"""
        initialize_workbook(md, "{}")

        result = delete_column(0, 0, 1)
        assert "error" not in result

        # Should have 2 columns now
        state = json.loads(get_state())
        headers = state["workbook"]["sheets"][0]["tables"][0]["headers"]
        assert len(headers) == 2

    def test_insert_with_partial_metadata(self):
        """Insert column when only some columns have metadata."""
        md = """# Tables
## Sheet1
| A | B | C |
|---|---|---|
| 1 | 2 | 3 |
"""
        initialize_workbook(md, "{}")

        # Only set metadata for columns 0 and 2
        visual_metadata = {
            "column_widths": {
                "0": 100,
                "2": 200,
            },
            "validation": {
                "1": {"type": "email"},
            },
        }
        update_visual_metadata(0, 0, visual_metadata)

        # Insert at index 1
        result = insert_column(0, 0, 1)
        assert "error" not in result

        visual = get_visual_metadata()

        # Column 0 unchanged
        assert visual["column_widths"]["0"] == 100

        # Empty column at index 1
        assert "1" not in visual["column_widths"]

        # Original column 1's validation moved to 2
        assert visual["validation"]["2"]["type"] == "email"

        # Original column 2's width moved to 3
        assert visual["column_widths"]["3"] == 200

    def test_multiple_inserts_sequential(self):
        """Multiple sequential inserts should accumulate correctly."""
        setup_workbook_with_metadata()

        # Insert at index 0 twice
        insert_column(0, 0, 0)
        insert_column(0, 0, 0)

        visual = get_visual_metadata()

        # Original column 0 should now be at index 2
        assert visual["column_widths"]["2"] == 100
        assert visual["validation"]["2"]["type"] == "integer"

        # Original column 3 should now be at index 5
        assert visual["column_widths"]["5"] == 250
        assert visual["validation"]["5"]["type"] == "email"

    def test_multiple_deletes_sequential(self):
        """Multiple sequential deletes should work correctly."""
        setup_workbook_with_metadata()

        # Delete index 0 twice
        delete_column(0, 0, 0)
        delete_column(0, 0, 0)

        visual = get_visual_metadata()

        # Original column 2 should now be at index 0
        assert visual["column_widths"]["0"] == 200
        assert visual["validation"]["0"]["type"] == "date"

        # Original column 3 should now be at index 1
        assert visual["column_widths"]["1"] == 250
        assert visual["validation"]["1"]["type"] == "email"

        # No more indices
        assert "2" not in visual["column_widths"]
        assert "3" not in visual["column_widths"]

    def test_insert_then_delete_restores_state(self):
        """Insert followed by delete at same position should restore original."""
        setup_workbook_with_metadata()

        # Get original state
        original_visual = get_visual_metadata()
        original_widths = dict(original_visual["column_widths"])

        # Insert then delete at index 1
        insert_column(0, 0, 1)
        delete_column(0, 0, 1)

        visual = get_visual_metadata()

        # Should be back to original
        assert visual["column_widths"] == original_widths

    def test_metadata_with_non_integer_keys(self):
        """Test metadata with non-integer keys (should be preserved)."""
        visual_metadata = {
            "column_widths": {
                "0": 100,
                "foo": 200,  # Non-integer key
                "1": 300,
            }
        }

        # Insert at 0
        shifted = _shift_column_metadata_indices({"visual": visual_metadata}, 0, 1)

        cw = shifted["visual"]["column_widths"]
        assert cw["1"] == 100  # Shifted 0
        assert cw["foo"] == 200  # Preserved
        assert cw["2"] == 300  # Shifted 1


# ============================================================================
# ALL METADATA TYPES TESTS
# ============================================================================


class TestAllMetadataTypesShift:
    """
    Verify all metadata types are shifted correctly.
    This ensures new metadata types added in the future are tested.
    """

    def test_all_types_shift_on_insert(self):
        """All column_indexed_keys should be shifted on insert."""
        setup_workbook_with_metadata()

        insert_column(0, 0, 1)

        visual = get_visual_metadata()

        # Verify all four types shifted for original column 1 -> 2
        assert visual["column_widths"]["2"] == 150  # was at 1
        assert visual["validation"]["2"]["type"] == "list"  # was at 1
        assert visual["columns"]["2"]["format"] == "text"  # was at 1
        assert visual["filters"]["2"] == ["hidden2", "hidden3"]  # was at 1

    def test_all_types_shift_on_delete(self):
        """All column_indexed_keys should be shifted on delete."""
        setup_workbook_with_metadata()

        delete_column(0, 0, 1)

        visual = get_visual_metadata()

        # Verify all four types shifted for original column 2 -> 1
        assert visual["column_widths"]["1"] == 200  # was at 2
        assert visual["validation"]["1"]["type"] == "date"  # was at 2
        assert visual["columns"]["1"]["format"] == "date"  # was at 2
        assert visual["filters"]["1"] == []  # was at 2

        # Verify column 1's data was deleted (not shifted down)
        # Original column 1 had validation type "list"
        assert visual["validation"]["1"]["type"] != "list"
