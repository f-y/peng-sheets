"""Tests for document section move operations.

These tests cover the move_document_section and move_workbook_section functions
which reorganize document sections within the markdown file.
"""

import json

import pytest
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import document as document_service
from md_spreadsheet_parser import Sheet, Table, Workbook


@pytest.fixture
def context():
    ctx = EditorContext()
    ctx.reset()
    from md_spreadsheet_parser import MultiTableParsingSchema

    ctx.update_state(schema=MultiTableParsingSchema())
    return ctx


class TestMoveDocumentSection:
    """Tests for move_document_section function."""

    def test_move_document_to_another_document_position(self, context):
        """Move Doc 1 to after Doc 2 (by specifying target position beyond all docs)."""
        md = """# Doc 1

Content of doc 1.

# Doc 2

Content of doc 2.

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        context.workbook = Workbook(sheets=[], metadata={})

        # Move Doc 1 (index 0) to after Doc 2
        # Since to_doc_index means "insert before doc at this index",
        # to move after Doc 2, we use to_doc_index=2 (insert at end)
        result = document_service.move_document_section(
            context, from_doc_index=0, to_doc_index=2
        )

        assert "error" not in result
        assert result.get("file_changed") is True

        # Verify order changed: Doc 2 should now appear before Doc 1's content
        new_md = context.md_text
        doc1_pos = new_md.find("# Doc 1")
        doc2_pos = new_md.find("# Doc 2")
        assert doc2_pos < doc1_pos, "Doc 2 should appear before Doc 1 after move"

    def test_move_document_to_after_workbook(self, context):
        """Move document to appear after the workbook section."""
        md = """# Intro

Some intro text.

# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A", "B"], rows=[["1", "2"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})

        # Move Intro doc to after workbook
        result = document_service.move_document_section(
            context, from_doc_index=0, to_after_workbook=True
        )

        assert "error" not in result
        assert result.get("file_changed") is True

        new_md = context.md_text
        intro_pos = new_md.find("# Intro")
        tables_pos = new_md.find("# Tables")
        assert tables_pos < intro_pos, "Intro should appear after Tables"

    def test_move_document_to_before_workbook(self, context):
        """Move document from end to before workbook."""
        md = """# Tables

## Sheet 1

| A |
|---|
| 1 |

# Epilogue

Epilogue text.
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})

        # Move Epilogue (index 0, since it's the only doc) to before workbook
        result = document_service.move_document_section(
            context, from_doc_index=0, to_before_workbook=True
        )

        assert "error" not in result
        assert result.get("file_changed") is True

        new_md = context.md_text
        epilogue_pos = new_md.find("# Epilogue")
        tables_pos = new_md.find("# Tables")
        assert epilogue_pos < tables_pos, "Epilogue should appear before Tables"

    def test_move_document_with_tab_order_index(self, context):
        """Move document and update tab_order metadata."""
        md = """# Doc 1

Content 1.

# Doc 2

Content 2.

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(
            sheets=[sheet],
            metadata={
                "tab_order": [
                    {"type": "document", "index": 0},
                    {"type": "document", "index": 1},
                    {"type": "sheet", "index": 0},
                ]
            },
        )

        # Move Doc 1 to after Doc 2, updating tab order
        result = document_service.move_document_section(
            context, from_doc_index=0, to_doc_index=2, target_tab_order_index=2
        )

        assert "error" not in result
        assert result.get("metadata_changed") is True

    def test_move_document_invalid_source_index(self, context):
        """Moving from invalid index should return error."""
        md = """# Doc 1

Content.

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        context.workbook = Workbook(sheets=[], metadata={})

        result = document_service.move_document_section(
            context, from_doc_index=99, to_doc_index=0
        )

        assert "error" in result
        assert "Invalid source" in result["error"]

    def test_move_document_same_position_no_change(self, context):
        """Moving document to same position should not change file."""
        md = """# Doc 1

Content.

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        context.workbook = Workbook(sheets=[], metadata={})

        result = document_service.move_document_section(
            context, from_doc_index=0, to_doc_index=0
        )

        assert result.get("file_changed") is False

    def test_move_document_no_target_specified(self, context):
        """Moving without target should return error."""
        md = """# Doc 1

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        context.workbook = Workbook(sheets=[], metadata={})

        result = document_service.move_document_section(context, from_doc_index=0)

        assert "error" in result


class TestMoveWorkbookSection:
    """Tests for move_workbook_section function."""

    def test_move_workbook_before_document(self, context):
        """Move workbook section to before a document."""
        md = """# Intro

Intro text.

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})

        # Move workbook to before Intro (to_doc_index=0, to_before_doc=True)
        result = document_service.move_workbook_section(
            context, to_doc_index=0, to_before_doc=True
        )

        assert "error" not in result
        assert result.get("file_changed") is True

        new_md = context.md_text
        intro_pos = new_md.find("# Intro")
        tables_pos = new_md.find("# Tables")
        assert tables_pos < intro_pos, "Tables should appear before Intro"

    def test_move_workbook_after_document(self, context):
        """Move workbook to after a document (default position)."""
        md = """# Tables

## Sheet 1

| A |
|---|
| 1 |

# Outro

Outro text.
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})

        # Move workbook to after Outro (to_doc_index=0, to_after_doc=True)
        result = document_service.move_workbook_section(
            context, to_doc_index=0, to_after_doc=True
        )

        assert "error" not in result
        assert result.get("file_changed") is True

        new_md = context.md_text
        outro_pos = new_md.find("# Outro")
        tables_pos = new_md.find("# Tables")
        assert outro_pos < tables_pos, "Outro should appear before Tables"

    def test_move_workbook_with_tab_order_update(self, context):
        """Move workbook and update tab_order metadata."""
        md = """# Doc 1

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |

<!-- md-spreadsheet-workbook-metadata: {"tab_order": [{"type": "document", "index": 0}, {"type": "sheet", "index": 0}]} -->
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(
            sheets=[sheet],
            metadata={
                "tab_order": [
                    {"type": "document", "index": 0},
                    {"type": "sheet", "index": 0},
                ]
            },
        )

        # Move workbook before Doc 1 with updated tab order
        result = document_service.move_workbook_section(
            context, to_doc_index=0, to_before_doc=True, target_tab_order_index=0
        )

        assert "error" not in result

        # Check tab_order was updated
        new_tab_order = context.workbook.metadata.get("tab_order", [])
        assert len(new_tab_order) == 2

    def test_move_workbook_no_workbook_found(self, context):
        """Moving workbook when none exists should return error."""
        md = """# Doc 1

Content.
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        context.workbook = Workbook(sheets=[], metadata={})

        result = document_service.move_workbook_section(
            context, to_doc_index=0, to_before_doc=True
        )

        assert "error" in result
        assert "No workbook section found" in result["error"]

    def test_move_workbook_invalid_target_index(self, context):
        """Moving to invalid target should return error."""
        md = """# Doc 1

Content.

# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})

        result = document_service.move_workbook_section(
            context, to_doc_index=-5, to_before_doc=True
        )

        assert "error" in result

    def test_move_workbook_no_target_specified(self, context):
        """Moving without target should return error."""
        md = """# Doc 1

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})
        table = Table(headers=["A"], rows=[[]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})

        result = document_service.move_workbook_section(context, to_doc_index=None)

        assert "error" in result


class TestGetDocumentSectionRange:
    """Tests for get_document_section_range function."""

    def test_get_range_basic(self, context):
        """Get range of a document section."""
        md = """# Doc 1

Content of doc 1.
Line 2.

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})

        result = document_service.get_document_section_range(context, 0)

        assert "error" not in result
        assert "start_line" in result
        assert "end_line" in result
        assert result["start_line"] == 0
        # End should be before # Tables

    def test_get_range_ignores_code_blocks(self, context):
        """Headers inside code blocks should be ignored."""
        md = """# Doc 1

```markdown
# Not a Doc
```

More content.

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})

        result = document_service.get_document_section_range(context, 0)

        assert "error" not in result
        # Should include the code block as part of Doc 1
        assert result["start_line"] == 0

    def test_get_range_invalid_index(self, context):
        """Getting range of non-existent document should return error."""
        md = """# Doc 1

# Tables
"""
        context.md_text = md
        context.config = json.dumps({"rootMarker": "# Tables"})

        result = document_service.get_document_section_range(context, 99)

        assert "error" in result
        assert "Invalid section index" in result["error"]
