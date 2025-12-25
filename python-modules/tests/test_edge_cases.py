"""
Tests for edge cases and remaining uncovered lines in headless_editor.
"""

import headless_editor
from headless_editor import (
    _shift_column_metadata_indices,
    add_sheet,
    get_document_section_range,
    get_workbook_range,
    initialize_workbook,
    paste_cells,
)


class TestEdgeCases:
    def setup_method(self):
        # Reset global state manually
        headless_editor.workbook = None
        headless_editor.md_text = ""
        headless_editor.schema = None
        headless_editor.config = ""

    def test_code_block_headers_ignored(self):
        """Headers inside code blocks should be ignored by get_document_section_range."""
        md = """# Tables
## Sheet1
| A |
|---|
| 1 |

# Doc 1

```markdown
# Ignored Header
```

# Doc 2
"""
        initialize_workbook(md, "{}")
        # Verify Doc 1 range
        r1 = get_document_section_range(headless_editor.workbook, 0)
        assert "error" not in r1
        # Check end line to verify that the header inside the code block was ignored
        # Doc 1 starts at 32. Ignored Header is at 35. Doc 2 starts at 38.
        # If ignored, Doc 1 should end just before Doc 2 (line 37).
        assert r1["end_line"] == 11

        # Verify Doc 2 range
        r2 = get_document_section_range(headless_editor.workbook, 1)
        assert "error" not in r2

        # There should be no Doc 3
        r3 = get_document_section_range(headless_editor.workbook, 2)
        assert "error" in r3

    def test_paste_empty_data(self):
        """Test pasting empty data (no rows)."""
        md = "# Tables\n## Sheet1\n| A |"
        initialize_workbook(md, "{}")

        # Paste empty list
        # include_headers=False
        res = paste_cells(0, 0, 0, 0, [])
        assert "error" not in res

        # Verify content contains the original table
        assert "| A |" in res["content"]

        # Actually paste_cells logic: if rows_to_paste == 0 and not include_headers: return t (no change)
        # Wait, apply_workbook_update generates new MD. Even if content is same.

    def test_shift_metadata_edge_cases(self):
        """Test _shift_column_metadata_indices with empty or invalid metadata."""
        # Empty metadata
        res = _shift_column_metadata_indices({}, 0, 1)
        assert res == {}

        # Metadata without visual
        res = _shift_column_metadata_indices({"other": 1}, 0, 1)
        assert res == {"other": 1}

        # Visual with non-dict entry
        meta = {
            "visual": {
                "column_widths": "invalid",  # Should be ignored
                "columns": {"1": {"width": 100}},
            }
        }
        res = _shift_column_metadata_indices(meta, 0, 1)
        # column_widths should remain "invalid" (ignored by processing loop)
        assert res["visual"]["column_widths"] == "invalid"
        # columns should be shifted
        assert "2" in res["visual"]["columns"]

    def test_add_sheet_error(self):
        """Force an error in add_sheet using mock."""
        from unittest.mock import patch

        md = "# Tables"
        initialize_workbook(md, "{}")

        # generate_and_get_range is called at end of add_sheet.
        # Patch it to raise Exception
        with patch(
            "headless_editor.generate_and_get_range",
            side_effect=Exception("Forced Error"),
        ):
            res = add_sheet("New Sheet")
            assert "error" in res

            assert "Forced Error" in res["error"]

    def test_root_marker_after_code_block(self):
        """Test finding root marker after a code block covers line 68."""
        md = "\n```\nCode block\n```\n\n# Tables\n## Sheet1\n| A |\n|---|\n| 1 |\n\n```\nBlock 2\n```\n"
        initialize_workbook(md, "{}")
        get_document_section_range(headless_editor.workbook, 0)

        # Cover get_workbook_range loops
        get_workbook_range(md, "# Tables", 2)

    def test_empty_markdown(self):
        """Test empty markdown covers line 151 (start_line < 0 case)."""
        headless_editor.md_text = ""
        from headless_editor import generate_and_get_range

        # Ensure workbook is valid so it proceeds
        # Need to import Workbook
        from md_spreadsheet_parser import Workbook

        headless_editor.workbook = Workbook(sheets=[])
        headless_editor.schema = {}

        res = generate_and_get_range()
        assert res["startLine"] == 0

    def test_delete_table_error(self):
        """Test delete_table invalid index covers line 224."""
        md = "# Tables\n## Sheet1\n| A |"
        initialize_workbook(md, "{}")
        from headless_editor import delete_table

        # Invalid table index
        res = delete_table(0, 99)
        assert "error" in res
        assert "Invalid table index" in res["error"]

    def test_paste_cells_padding(self):
        """Test paste_cells expanding rows and padding (covers line 545)."""
        # Create table with 2 rows. We will paste only into row 0, extending columns.
        # Row 1 will be left untouched during paste, so it must be padded by the padding loop.
        md = "# Tables\n## Sheet1\n| A | B |\n|---|---|\n| 1 | 2 |\n| 3 | 4 |"
        initialize_workbook(md, "{}")

        # Paste causing column expansion (add headers)
        # include_headers=True
        # Start col 2 (new col), Start row 0 (header update + data row 0 update)

        data = [["NewCol1", "NewCol2"], ["Val1", "Val2"]]

        # Paste at col 2
        res = paste_cells(0, 0, 0, 2, data, include_headers=True)
        assert "error" not in res
        assert "NewCol1" in res["content"]
        assert "Val1" in res["content"]

    def test_get_state_coverage(self):
        """Test get_state to cover augment_workbook_metadata."""
        md = (
            "\n"
            "```\n"
            "Code block\n"
            "```\n"
            "\n"
            "# Tables\n"
            "## Sheet1\n"
            "| A |\n"
            "|---|\n"
            "| 1 |\n"
            "\n"
            "```\n"
            "Code block\n"
            "```\n"
            "\n"
            "## Sheet2\n"
            "| B |\n"
            "|---|\n"
            "| 2 |\n"
        )
        initialize_workbook(md, "{}")
        # Initialize done. Call get_state.
        from headless_editor import get_state

        state_json = get_state()
        assert "workbook" in state_json

        # Also test with NO workbook
        headless_editor.workbook = None
        res = get_state()
        assert "error" in res

        # Test extra headers in Markdown vs Workbook (covers line 609)
        # Restore workbook first
        initialize_workbook(md, "{}")  # Reset

        # Remove one sheet from workbook object, but MD still has it
        from dataclasses import replace

        wb = headless_editor.workbook
        headless_editor.workbook = replace(wb, sheets=list(wb.sheets)[:-1])
        get_state()

    def test_unused_methods_coverage(self):
        """Cover update_sheet_metadata, update_table_metadata, update_column_align etc."""
        from headless_editor import (
            update_column_align,
            update_sheet_metadata,
            update_table_metadata,
        )

        md = "# Tables\n## Sheet1\n| A |"
        initialize_workbook(md, "{}")

        res = update_sheet_metadata(0, {"new": "meta"})
        assert "error" not in res

        res = update_table_metadata(0, 0, "New Name", "New Desc")
        assert "error" not in res

        # Cover update_column_align padding (col 5 > existing)
        res = update_column_align(0, 0, 5, "left")
        assert "error" not in res

    def test_sort_rows_coverage(self):
        """Cover sort_rows and forced type error handling."""
        from headless_editor import sort_rows

        md = "# Tables\n## Sheet1\n| A | B | C |\n|---|---|---|\n| 10 | Z | 10 |\n| 2 | A | bad |\n| | M | 5 |\n| Short |"
        initialize_workbook(md, "{}")

        sort_rows(0, 0, 0, True)
        sort_rows(0, 0, 1, True)
        sort_rows(0, 0, 2, True)

        # Forced type error coverage
        from dataclasses import replace

        import headless_editor

        wb = headless_editor.workbook
        sheet = wb.sheets[0]
        table = sheet.tables[0]

        # Force Col 1 (Z, A, M) to be number -> triggers ValueError in sort logic
        new_meta_for_col1 = {"visual": {"columns": {"1": {"type": "number"}}}}
        new_table = replace(table, metadata=new_meta_for_col1)
        new_sheet = replace(sheet, tables=[new_table])
        headless_editor.workbook = replace(wb, sheets=[new_sheet])

        # Sort by Col 1 ("Z", "A", "M") forcing "number" type.
        sort_rows(0, 0, 1, True)

        # Force a short row to cover line 1461 in _infer_column_type
        # Recapture workbook
        wb = headless_editor.workbook
        sheet = wb.sheets[0]
        table = sheet.tables[0]
        rows = list(table.rows)
        rows.append(["ShortForSure"])  # Length 1
        new_table = replace(table, rows=rows)
        new_sheet = replace(sheet, tables=[new_table])
        headless_editor.workbook = replace(wb, sheets=[new_sheet])

        # Sort by col 2. Row len 1. 2 >= 1. Should continue.
        sort_rows(0, 0, 2, True)
