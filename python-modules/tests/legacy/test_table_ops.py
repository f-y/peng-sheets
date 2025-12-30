"""
Tests for table operations: delete_table, delete_rows.
"""

from headless_editor import (
    delete_rows,
    delete_table,
    initialize_workbook,
    paste_cells,
)


class TestTableOps:
    def test_delete_table(self):
        """Test deleting a table."""
        md = """# Tables
## Sheet1
| A | B |
|---|---|
| 1 | 2 |

Some text

| C | D |
|---|---|
| 3 | 4 |
"""
        initialize_workbook(md, "{}")

        # Delete first table (index 0)
        result = delete_table(0, 0)
        md_out = result["content"]

        assert "| A | B |" not in md_out
        assert "| C | D |" in md_out

    def test_delete_rows(self):
        """Test deleting rows."""
        md = """# Tables
## Sheet1
| A | B |
|---|---|
| 1 | 2 |
| 3 | 4 |
| 5 | 6 |
"""
        initialize_workbook(md, "{}")

        # Delete row 0 (value 1, 2) and row 2 (value 5, 6)
        # Note: 0-based index from data rows (header is not row 0)
        # Implementation depends on Table model, usually 0 is first data row.
        result = delete_rows(0, 0, [0, 2])
        md_out = result["content"]

        assert "| 1 | 2 |" not in md_out
        assert "| 3 | 4 |" in md_out
        assert "| 5 | 6 |" not in md_out

    def test_paste_headers(self):
        """Test patching cells with include_headers=True to update headers."""
        md = """# Tables
## Sheet1
| A | B |
|---|---|
| 1 | 2 |
"""
        initialize_workbook(md, "{}")

        # Paste with headers at row 0, col 2 (new columns)
        # New data: Header C, Value 3
        new_data = [["HeaderC"], ["3"]]

        # include_headers=True
        result = paste_cells(0, 0, 0, 2, new_data, include_headers=True)
        md_out = result["content"]

        # Check if HeaderC is in output
        # The table should look like | A | B | HeaderC |
        assert "| A | B | HeaderC |" in md_out
