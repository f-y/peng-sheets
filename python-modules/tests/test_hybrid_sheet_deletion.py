"""Tests for sheet deletion with trailing content (hybrid document)."""

import json

import headless_editor
import pytest
from headless_editor import (
    delete_sheet,
    get_workbook_range,
    initialize_workbook,
)

# Hybrid document with content after workbook
HYBRID_MD = """# Project Overview

This is a design document.

# Tables

## Budget

### Q1 Budget

| Category | Amount |
| --- | --- |
| Server | $500 |

# Appendix

## Glossaries

- **MVP**: Minimum Viable Product
"""

MOCK_CONFIG = json.dumps(
    {"rootMarker": "# Tables", "sheetHeaderLevel": 2, "tableHeaderLevel": 3}
)


def test_get_workbook_range_with_trailing_content():
    """Test that get_workbook_range correctly finds the end of workbook section."""
    start, end = get_workbook_range(HYBRID_MD, "# Tables", 2)

    lines = HYBRID_MD.split("\n")

    # Find expected start (# Tables line)
    expected_start = None
    for i, line in enumerate(lines):
        if line.strip() == "# Tables":
            expected_start = i
            break

    # Find expected end (# Appendix line)
    expected_end = None
    for i, line in enumerate(lines):
        if line.strip() == "# Appendix":
            expected_end = i
            break

    assert start == expected_start, (
        f"Start should be at '# Tables' line ({expected_start}), got {start}"
    )
    assert end == expected_end, (
        f"End should be at '# Appendix' line ({expected_end}), got {end}"
    )


def test_delete_sheet_preserves_trailing_content():
    """Test that deleting a sheet preserves content after the workbook."""
    initialize_workbook(HYBRID_MD, MOCK_CONFIG)

    # Verify we have 1 sheet
    assert len(headless_editor.workbook.sheets) == 1
    assert headless_editor.workbook.sheets[0].name == "Budget"

    # Delete the sheet
    result = delete_sheet(0)

    assert "error" not in result, f"Unexpected error: {result.get('error')}"
    assert "content" in result

    # The replacement content should NOT include the Appendix
    content = result["content"]

    # The content should be empty or just the header for empty workbook
    # But should NOT contain "Appendix" or "Glossaries"
    assert "Appendix" not in content, (
        f"Appendix should not be in replacement content: {content}"
    )
    assert "Glossaries" not in content, (
        f"Glossaries should not be in replacement content: {content}"
    )

    # Verify the range is correct
    lines = HYBRID_MD.split("\n")
    appendix_line = None
    for i, line in enumerate(lines):
        if line.strip() == "# Appendix":
            appendix_line = i
            break

    # endLine should be at or before the Appendix line
    assert result["endLine"] <= appendix_line, (
        f"endLine ({result['endLine']}) should be <= appendix line ({appendix_line})"
    )


def test_delete_last_sheet_preserves_trailing_content():
    """Test that deleting the last sheet (resulting in no sheets) preserves trailing content."""
    initialize_workbook(HYBRID_MD, MOCK_CONFIG)

    result = delete_sheet(0)

    assert "error" not in result, f"Unexpected error: {result.get('error')}"

    # After deleting all sheets, the workbook section should be removed
    # But the trailing content (Appendix) must be preserved
    # The replacement should only cover the workbook section

    lines = HYBRID_MD.split("\n")
    tables_line = None
    appendix_line = None

    for i, line in enumerate(lines):
        if line.strip() == "# Tables":
            tables_line = i
        if line.strip() == "# Appendix":
            appendix_line = i

    assert result["startLine"] == tables_line
    assert result["endLine"] < appendix_line or (
        result["endLine"] == appendix_line and result.get("endCol", 0) == 0
    )
