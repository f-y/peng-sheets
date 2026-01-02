# Markdown Spreadsheet Overview

This document is a hybrid notebook designed to demonstrate the capabilities of the **VS Code Extension** and the **Python Parser**.
It showcases the power of managing both documentation (context) and spreadsheet data (tables) within a single file.
This file itself is structured to be parseable by `md-spreadsheet-parser`.

## 1. VS Code Extension Features

`vscode-md-spreadsheet` is an extension that enables editing Markdown tables with a comfortable, Excel-like UI.

### Core Philosophy
- **Keyboard First**: Respects the mental model of Excel users, including arrow key navigation, `F2` for editing, and `Enter`/`Tab` for committing changes.
- **Hybrid View**: Seamlessly switches between standard Markdown text (document tab) and table editing (sheet tab).
- **Safe Editing**: Implements a robust Undo/Redo system, allowing you to edit without fear of mistakes.

### Advanced Editing
- **Formula Columns**: A new concept for calculated columns that separates data (Markdown) from logic (Metadata).
- **Standard Formatting**: Supports standard Markdown formatting such as Bold (`Ctrl+B`), Italic (`Ctrl+I`), and Link (`Ctrl+K`).
- **Metadata Persistence**: Column widths and filter settings are saved as metadata within HTML comments to preserve Markdown readability.

## 2. Python Parser Capabilities

By using the `md-spreadsheet-parser` library, you can handle such Markdown files simply and with type safety.

### Basic Usage

```python
from md_spreadsheet_parser import parse_workbook

# Load this file
wb = parse_workbook("hybrid_notebook.md")

# Access sheets and tables
sheet = wb.get_sheet("Comparison")
table = sheet.get_table("Excel vs MD Suite")

# Get row data
for row in table.rows:
    print(f"Feature: {row[0]}, VS Code: {row[2]}")
```

### Type-Safe Validation

Integrates with Pydantic and Dataclasses to validate table data as structured data.

```python
from pydantic import BaseModel

class FeatureComparison(BaseModel):
    feature: str
    excel: str
    markdown_suite: str
    notes: str | None = None

# Load with validation
models = table.to_models(FeatureComparison)
```
