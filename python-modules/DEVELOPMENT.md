# Python Modules Development Guide

This directory contains Python modules that run inside Pyodide in the VS Code extension's webview. These modules provide the core editing logic for markdown spreadsheets.

## Directory Structure

```
python-modules/
├── headless_editor.py    # Main editing engine
├── pyodide_cache.py      # Pyodide package cache management
├── pyproject.toml        # Python project configuration
├── README.md             # Basic overview
├── src/                  # Reserved for future module extraction
└── tests/                # Pytest test suite
```

## Architecture Guidelines

### Core Principles

1.  **Stateless Operations**: Most functions should be stateless transformers. They take parameters and return a result (update spec or new state) without relying on hidden global state where possible.
2.  **JSON-Interoperable**: All inputs and outputs must be JSON-serializable to ensure seamless communication with the TypeScript frontend.
3.  **Error containment**: Operations should catch expected errors and return structured error objects, causing the frontend to handle them gracefully rather than crashing the Python runtime.

### Module Organization

Currently, `headless_editor.py` acts as the facade and implementation. As the codebase grows, logic should be extracted into specialized modules under `src/`:

- `src/metadata/`: Metadata manipulation logic
- `src/operations/`: Core table operations (insert/delete/move)
- `src/parser/`: Parser extensions or wrappers

## Modules

### `headless_editor.py`

The main editing engine that provides all spreadsheet editing operations. Key function groups:

#### Initialization & State

| Function | Description |
|----------|-------------|
| `initialize_workbook(md_text, config_json)` | Initialize workbook from markdown |
| `get_state()` | Get current workbook state as JSON |
| `get_full_markdown()` | Get full markdown with all updates |
| `generate_and_get_range()` | Generate markdown and return line range |

#### Cell & Row Operations

| Function | Description |
|----------|-------------|
| `update_cell(sheet, table, row, col, value)` | Update cell value |
| `insert_row(sheet, table, row)` | Insert row at index |
| `delete_row(sheet, table, row)` | Delete row at index |
| `delete_rows(sheet, table, row_indices)` | Delete multiple rows |
| `paste_cells(sheet, table, start_row, start_col, data)` | Paste data grid |

#### Column Operations

| Function | Description |
|----------|-------------|
| `insert_column(sheet, table, col)` | Insert column at index |
| `delete_column(sheet, table, col)` | Delete column at index |
| `clear_column(sheet, table, col)` | Clear column values |
| `update_column_width(sheet, table, col, width)` | Update column width |
| `update_column_filter(sheet, table, col, hidden_values)` | Set filter |
| `update_column_align(sheet, table, col, alignment)` | Set GFM alignment |
| `update_column_format(sheet, table, col, format_config)` | Set display format |
| `sort_rows(sheet, table, col, ascending)` | Sort by column |

#### Visual Metadata

| Function | Description |
|----------|-------------|
| `update_visual_metadata(sheet, table, metadata)` | Update visual metadata |
| `_shift_column_metadata_indices(metadata, col, direction)` | Shift column indices |

#### Sheet Operations

| Function | Description |
|----------|-------------|
| `add_sheet(name, column_names)` | Add new sheet |
| `delete_sheet(sheet)` | Delete sheet |
| `rename_sheet(sheet, name)` | Rename sheet |
| `move_sheet(from, to, tab_order_index)` | Move sheet position |
| `update_sheet_metadata(sheet, metadata)` | Update sheet metadata |

#### Table Operations

| Function | Description |
|----------|-------------|
| `add_table(sheet, column_names)` | Add table to sheet |
| `delete_table(sheet, table)` | Delete table |
| `update_table_metadata(sheet, table, name, desc)` | Update table metadata |

#### Document Operations

| Function | Description |
|----------|-------------|
| `add_document(title, after_index)` | Add document section |
| `rename_document(doc_index, title)` | Rename document |
| `delete_document(doc_index)` | Delete document |
| `move_document_section(from, to)` | Move document section |

#### Tab Order

| Function | Description |
|----------|-------------|
| `update_workbook_tab_order(tab_order)` | Update tab display order |

### `pyodide_cache.py`

Manages the IndexedDB-based package cache for Pyodide to avoid re-installing packages on every load.

| Function | Description |
|----------|-------------|
| `setup_cached_path(path)` | Add cache to sys.path |
| `cleanup_corrupted_cache(path, prefix)` | Clean corrupted cache |
| `cache_installed_packages(mount_dir, uri)` | Cache packages to IndexedDB |

---

## Metadata Architecture

Visual metadata is stored in `table.metadata.visual` and contains column-indexed keys:

| Key | Description | Example |
|-----|-------------|---------|
| `column_widths` | Column width in pixels | `{"0": 100, "1": 150}` |
| `validation` | Data validation rules | `{"0": {"type": "list", "values": ["A", "B"]}}` |
| `columns` | Column display format | `{"0": {"format": "number", "decimals": 2}}` |
| `filters` | Hidden filter values | `{"0": ["hidden_value"]}` |

### Column Index Shifting

When columns are inserted or deleted, all column-indexed metadata must be shifted:

- **Insert at index N**: All indices ≥ N shift by +1
- **Delete at index N**: Index N is removed, all indices > N shift by -1

This is handled by `_shift_column_metadata_indices()`. See [Test Design](#test-design) for coverage.

---

## Test Design

### Test Files

| File | Coverage |
|------|----------|
| `test_column_metadata_shift.py` | Column metadata index shifting on insert/delete |
| `test_column_format.py` | Column format operations |
| `test_filter_sort.py` | Filter and sort operations |
| `test_headless_editor.py` | Basic editor operations |
| `test_headless_inserts.py` | Row/column insert operations |
| `test_paste_cells.py` | Paste cell operations |
| `test_add_document.py` | Document section operations |
| `test_move_document_section.py` | Document move operations |
| `test_move_sheet.py` | Sheet move operations |
| `test_tab_order_metadata.py` | Tab order metadata management |
| `test_drag_drop_metadata.py` | Drag & drop metadata operations |
| `test_hybrid_sheet_deletion.py` | Hybrid sheet deletion scenarios |
| `test_sheet_metadata_update.py` | Sheet metadata updates |
| `test_smart_sort.py` | Type-aware smart sorting |
| `test_code_block_headers.py` | Code block in headers handling |
| `test_eof_behavior.py` | End-of-file edge cases |
| `test_pyodide_cache.py` | Pyodide cache utilities |

### Column Metadata Shift Tests (`test_column_metadata_shift.py`)

Comprehensive tests for ensuring column-indexed metadata stays in sync:

**Insert Tests:**
- Insert at start shifts all indices +1
- Insert in middle shifts only subsequent indices
- Insert at end shifts nothing

**Delete Tests:**
- Delete at start shifts all indices -1
- Delete in middle shifts only subsequent indices
- Delete at end removes only that index

**Edge Cases:**
- Operations with no metadata
- Operations with partial metadata
- Sequential insert/delete operations
- Insert then delete restores original state

**All Types Verification:**
- Verifies all 4 metadata types (column_widths, validation, columns, filters) are shifted

---

## Development Workflow

### Running Tests

```bash
cd python-modules
python -m pytest tests/ -v
```

### Type Checking

```bash
cd python-modules
uv run pyright
```

### Adding New Features

1. **Implement the feature** in `headless_editor.py`

2. **Write tests** in `tests/test_<feature>.py`
   - Test normal cases
   - Test edge cases (empty data, boundary conditions)
   - Test error handling

3. **If adding column-indexed metadata:**
   - Add the new key to `column_indexed_keys` in `_shift_column_metadata_indices()`
   - Add tests in `test_column_metadata_shift.py`:
     - `TestAllMetadataTypesShift.test_all_types_shift_on_insert`
     - `TestAllMetadataTypesShift.test_all_types_shift_on_delete`
   - Update this document's [Metadata Architecture](#metadata-architecture) section

4. **Run full test suite** to verify nothing broke

5. **Run type checker** to verify types

### Adding Column-Indexed Metadata

When adding a new column-indexed setting (like `column_widths`, `validation`):

1. **Update `_shift_column_metadata_indices()`**:
   ```python
   column_indexed_keys = ["column_widths", "validation", "columns", "filters", "YOUR_NEW_KEY"]
   ```

2. **Add test data in `test_column_metadata_shift.py`**:
   ```python
   def setup_workbook_with_metadata():
       visual_metadata = {
           # ... existing keys ...
           "YOUR_NEW_KEY": {
               "0": {...},
               "1": {...},
           },
       }
   ```

3. **Add assertions to `TestAllMetadataTypesShift`**:
   ```python
   def test_all_types_shift_on_insert(self):
       # ... existing assertions ...
       assert visual["YOUR_NEW_KEY"]["2"] == expected_value
   ```

---

## Dependencies

- `md-spreadsheet-parser`: Core parsing library (installed via micropip in Pyodide)
- `pytest`: Testing framework

## Notes

- All functions return JSON-serializable dicts with `content`, `startLine`, `endLine` or `error`
- Functions use 0-based indexing for sheet, table, row, and column indices
- Column indices in metadata are stored as strings (e.g., `"0"`, `"1"`) to maintain JSON compatibility

## Error Handling Policy

Functions exposed to the frontend should **never raise exceptions**. Instead, they must return a dictionary with an `error` key.

**Bad:**
```python
def my_op():
    raise ValueError("Invalid index")
```

**Good:**
```python
def my_op():
    if invalid:
        return {"error": "Invalid index"}
    return {"success": True}
```

## Performance Considerations

1.  **Avoid Full Reparsing**: Where possible, use localized updates. `headless_editor.py` often relies on full document regeneration (`get_full_markdown`) for simplicity in some ops, but for high-frequency ops (like typing in a cell), specialized update logic is preferred.
2.  **Metadata Size**: Visual metadata grows with the number of columns. Ensure `_shift_column_metadata_indices` remains efficient (O(N) where N is number of columns with metadata).
3.  **Pyodide Bridge Overhead**: Crossing the JS-Python bridge has overhead. Minimize the frequency of calls; batch operations if possible.

