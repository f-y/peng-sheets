"""Tests for EditorContext and utils_structure.

Covers edge cases for context state management and structure extraction.
"""

import json

import pytest
from md_spreadsheet_editor.context import EditorContext, EditorState
from md_spreadsheet_editor.utils_structure import (
    augment_workbook_metadata,
    extract_structure,
)
from md_spreadsheet_parser import MultiTableParsingSchema, Sheet, Table, Workbook


@pytest.fixture
def context():
    """Fresh context for each test."""
    ctx = EditorContext.get_instance()
    ctx.reset()
    return ctx


class TestEditorContext:
    """Tests for EditorContext singleton and state management."""

    def test_singleton_instance(self):
        """Should return same instance."""
        ctx1 = EditorContext.get_instance()
        ctx2 = EditorContext.get_instance()
        assert ctx1 is ctx2

    def test_reset_clears_state(self, context):
        """Reset should clear all state."""
        context.workbook = Workbook(sheets=[], metadata={})
        context.md_text = "# Content"
        context.config = "{}"
        context.schema = MultiTableParsingSchema()

        context.reset()

        assert context.workbook is None
        assert context.md_text == ""
        assert context.config is None
        assert context.schema is None

    def test_update_state_partial(self, context):
        """update_state can update individual fields."""
        context.update_state(md_text="# Test")
        assert context.md_text == "# Test"
        assert context.workbook is None  # Not updated

        wb = Workbook(sheets=[], metadata={})
        context.update_state(workbook=wb)
        assert context.workbook == wb
        assert context.md_text == "# Test"  # Still set

    def test_update_state_config(self, context):
        """update_state with config."""
        config = json.dumps({"rootMarker": "# Data"})
        context.update_state(config=config)
        assert context.config == config

    def test_update_state_schema(self, context):
        """update_state with schema."""
        schema = MultiTableParsingSchema(root_marker="# Data")
        context.update_state(schema=schema)
        assert context.schema == schema

    def test_get_full_state_dict_no_workbook(self, context):
        """get_full_state_dict with no workbook."""
        result = context.get_full_state_dict()
        parsed = json.loads(result)
        assert parsed["workbook"] is None
        assert parsed["structure"] is None

    def test_get_full_state_dict_with_workbook(self, context):
        """get_full_state_dict with workbook and schema."""
        table = Table(headers=["A"], rows=[["1"]], metadata={})
        sheet = Sheet(name="Sheet 1", tables=[table])
        context.workbook = Workbook(sheets=[sheet], metadata={})
        context.schema = MultiTableParsingSchema()
        context.md_text = "# Tables\n\n## Sheet 1\n\n| A |\n|---|\n| 1 |"

        result = context.get_full_state_dict()
        parsed = json.loads(result)

        assert parsed["workbook"] is not None
        assert parsed["structure"] is not None

    def test_initialize_workbook_parses_md(self, context):
        """initialize_workbook should parse markdown and set state."""
        md = """# Tables

## Sheet 1

| A | B |
|---|---|
| 1 | 2 |
"""
        config = json.dumps({"rootMarker": "# Tables"})
        context.initialize_workbook(md, config)

        assert context.workbook is not None
        assert len(context.workbook.sheets) == 1
        assert context.schema is not None
        assert context.md_text == md

    def test_get_state_alias(self, context):
        """get_state is alias for get_full_state_dict."""
        assert context.get_state() == context.get_full_state_dict()


class TestEditorState:
    """Tests for EditorState dataclass."""

    def test_default_values(self):
        """EditorState has proper defaults."""
        state = EditorState()
        assert state.workbook is None
        assert state.schema is None
        assert state.md_text == ""
        assert state.config is None


class TestExtractStructure:
    """Tests for extract_structure function."""

    def test_basic_documents_and_workbook(self):
        """Extract document and workbook sections."""
        md = """# Intro

Intro content.

# Tables

## Sheet 1

# Outro

Outro content.
"""
        result = extract_structure(md, "# Tables")
        sections = json.loads(result)

        assert len(sections) == 3
        assert sections[0]["type"] == "document"
        assert sections[0]["title"] == "Intro"
        assert sections[1]["type"] == "workbook"
        assert sections[2]["type"] == "document"
        assert sections[2]["title"] == "Outro"

    def test_code_block_headers_ignored(self):
        """Headers inside code blocks should be ignored."""
        md = """# Doc 1

```
# Fake Doc
```

# Tables
"""
        result = extract_structure(md, "# Tables")
        sections = json.loads(result)

        # Should have 1 document and 1 workbook
        doc_sections = [s for s in sections if s["type"] == "document"]
        assert len(doc_sections) == 1
        assert doc_sections[0]["title"] == "Doc 1"

    def test_document_content_capture(self):
        """Document sections should include their content."""
        md = """# My Doc

Line 1.
Line 2.
Line 3.

# Tables
"""
        result = extract_structure(md, "# Tables")
        sections = json.loads(result)

        doc = sections[0]
        assert "Line 1" in doc["content"]
        assert "Line 2" in doc["content"]
        assert "Line 3" in doc["content"]

    def test_only_workbook(self):
        """File with only workbook section."""
        md = """# Tables

## Sheet 1

| A |
|---|
| 1 |
"""
        result = extract_structure(md, "# Tables")
        sections = json.loads(result)

        assert len(sections) == 1
        assert sections[0]["type"] == "workbook"

    def test_only_documents(self):
        """File with only document sections."""
        md = """# Doc 1

Content 1.

# Doc 2

Content 2.
"""
        result = extract_structure(md, "# Tables")
        sections = json.loads(result)

        assert len(sections) == 2
        assert all(s["type"] == "document" for s in sections)


class TestAugmentWorkbookMetadata:
    """Tests for augment_workbook_metadata function."""

    def test_adds_header_line_numbers(self):
        """Should add header_line to each sheet."""
        md = """# Tables

## Sheet 1

| A |
|---|
| 1 |

## Sheet 2

| B |
|---|
| 2 |
"""
        workbook_dict = {
            "sheets": [
                {"name": "Sheet 1", "tables": []},
                {"name": "Sheet 2", "tables": []},
            ]
        }

        result = augment_workbook_metadata(workbook_dict, md, "# Tables", 2)

        assert "header_line" in result["sheets"][0]
        assert "header_line" in result["sheets"][1]
        assert result["sheets"][0]["header_line"] == 2
        assert result["sheets"][1]["header_line"] == 8

    def test_code_block_handling(self):
        """Headers inside code blocks should be ignored."""
        md = """# Tables

```
## Fake Sheet
```

## Real Sheet

| A |
|---|
| 1 |
"""
        workbook_dict = {"sheets": [{"name": "Real Sheet", "tables": []}]}

        result = augment_workbook_metadata(workbook_dict, md, "# Tables", 2)

        # Should find "## Real Sheet" at line 6, not the one in code block
        assert result["sheets"][0]["header_line"] == 6

    def test_stops_at_higher_level_header(self):
        """Should stop when higher level header is encountered."""
        md = """# Tables

## Sheet 1

| A |
|---|

# Appendix

## Section (not a sheet)
"""
        workbook_dict = {"sheets": [{"name": "Sheet 1", "tables": []}]}

        result = augment_workbook_metadata(workbook_dict, md, "# Tables", 2)

        # Should only find Sheet 1, not Section
        assert result["sheets"][0]["header_line"] == 2

    def test_more_sheets_in_dict_than_md(self):
        """Handle case where dict has more sheets than found in markdown."""
        md = """# Tables

## Sheet 1

| A |
|---|
"""
        workbook_dict = {
            "sheets": [
                {"name": "Sheet 1", "tables": []},
                {"name": "Sheet 2", "tables": []},  # Not in markdown
            ]
        }

        result = augment_workbook_metadata(workbook_dict, md, "# Tables", 2)

        # First sheet gets header_line, second doesn't
        assert "header_line" in result["sheets"][0]
        assert "header_line" not in result["sheets"][1]

    def test_no_root_marker(self):
        """Handle empty root marker."""
        md = """## Sheet 1

| A |
|---|
| 1 |
"""
        workbook_dict = {"sheets": [{"name": "Sheet 1", "tables": []}]}

        result = augment_workbook_metadata(workbook_dict, md, "", 2)

        assert result["sheets"][0]["header_line"] == 0
