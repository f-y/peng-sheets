import json

from headless_editor import (
    _escape_pipe,
    get_document_section_range,
    get_state,
    initialize_workbook,
    update_column_width,
)


class TestUtils:
    def test_escape_pipe_basic(self):
        """Test basic pipe escaping."""
        assert _escape_pipe("a|b") == "a\\|b"
        assert _escape_pipe("|") == "\\|"
        assert _escape_pipe("||") == "\\|\\|"

    def test_escape_pipe_complex(self):
        """Test complex pipe escaping scenarios."""
        # Inside backticks should NOT be escaped
        assert _escape_pipe("`|`") == "`|`"
        assert _escape_pipe("a `|` b") == "a `|` b"
        assert _escape_pipe("`a|b` | c") == "`a|b` \\| c"

        # Already escaped should NOT be double escaped
        assert _escape_pipe("a\\|b") == "a\\|b"
        assert _escape_pipe("\\|") == "\\|"

        # Mixed
        assert _escape_pipe("`|` | \\|") == "`|` \\| \\|"


class TestDocumentSectionRange:
    def test_get_document_section_range(self):
        """Test getting range of document sections."""
        md = """# Doc 1
Line 1
Line 2

# Tables
## Sheet1
| A |
|---|
| 1 |

# Doc 2
Last line
"""
        initialize_workbook(md, "{}")

        # Doc 1 is index 0
        res = get_document_section_range(None, 0)
        assert res["start_line"] == 0
        assert res["end_line"] == 3  # Before # Workbook

        # Doc 2 is index 1
        res = get_document_section_range(None, 1)
        assert res["start_line"] == 10
        assert res["end_line"] == 12

    def test_get_document_section_range_invalid(self):
        """Test getting range with invalid index."""
        md = "# Doc 1\n"
        initialize_workbook(md, "{}")

        res = get_document_section_range(None, 99)
        assert "error" in res

        res = get_document_section_range(None, -1)
        assert "error" in res


class TestColumnWidth:
    def test_update_column_width(self):
        """Test updating column width metadata."""
        md = """# Tables
## Sheet1
| A | B |
|---|---|
| 1 | 2 |
"""
        initialize_workbook(md, "{}")

        # Update width for col 0
        update_column_width(0, 0, 0, 150)

        state = json.loads(get_state())
        vis = state["workbook"]["sheets"][0]["tables"][0]["metadata"]["visual"]
        assert vis["column_widths"]["0"] == 150

        # Update width for col 1
        update_column_width(0, 0, 1, 200)
        state = json.loads(get_state())
        vis = state["workbook"]["sheets"][0]["tables"][0]["metadata"]["visual"]
        assert vis["column_widths"]["1"] == 200
