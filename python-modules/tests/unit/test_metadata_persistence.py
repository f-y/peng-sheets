from md_spreadsheet_editor.api import initialize_workbook, insert_column


def test_metadata_persistence_insert_column():
    # Markdown with metadata
    md_text = """# Tables

## Sheet1

### Table1

| Col1 | Col2 |
| --- | --- |
| A | B |

<!-- md-spreadsheet-table-metadata: {"validation": {"0": {"type": "list", "values": ["A", "B"]}}} -->
"""

    # EditorContext.get_instance() # context is singleton, init via api
    # Mock config_json required for schema init
    config_json = "{}"
    initialize_workbook(md_text, config_json)

    # Insert column at index 0. Validation on "0" should shift to "1".
    result = insert_column(0, 0, 0, "NewCol")

    assert "error" not in result, f"Operation failed: {result.get('error')}"

    content = result.get("content", "")
    assert "md-spreadsheet-table-metadata" in content, (
        "Metadata block missing from update"
    )

    # Check validation shift
    # Expected: "1": { ... }
    assert '"1":' in content, "Validation key did not shift to '1'"
    assert '"0":' not in content, "Validation key '0' still present in configuration"
