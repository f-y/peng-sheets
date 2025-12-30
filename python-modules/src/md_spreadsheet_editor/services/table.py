from dataclasses import replace

from md_spreadsheet_parser import Table

from .sheet import apply_sheet_update


def add_table(context, sheet_idx, column_names=None):
    if column_names is None:
        column_names = ["Column 1", "Column 2", "Column 3"]

    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        new_table = Table(
            name=f"New Table {len(new_tables) + 1}",
            description="",
            headers=column_names,
            rows=[["" for _ in column_names]],
            metadata={},
        )
        new_tables.append(new_table)
        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_transform)


def delete_table(context, sheet_idx, table_idx):
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        del new_tables[table_idx]
        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_transform)


def rename_table(context, sheet_idx, table_idx, new_name):
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_table = replace(target_table, name=new_name)
        new_tables[table_idx] = new_table
        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_transform)


def _escape_pipe(value):
    """Escape pipe characters for GFM table cells.

    Converts | to \\| so the parser treats it as literal pipe.
    Note: Pipes inside backticks are handled by the parser, but raw pipes need escaping.
    """
    if not value or "|" not in value:
        return value

    # Don't escape pipes that are already escaped or inside backticks
    result = []
    in_code = False
    i = 0
    n = len(value)

    while i < n:
        char = value[i]

        if char == "`":
            in_code = not in_code
            result.append(char)
            i += 1
        elif char == "\\" and i + 1 < n:
            # Already escaped, keep as is
            result.append(char)
            result.append(value[i + 1])
            i += 2
        elif char == "|" and not in_code:
            # Escape the pipe
            result.append("\\|")
            i += 1
        else:
            result.append(char)
            i += 1

    return "".join(result)


def update_cell(context, sheet_idx, table_idx, row_idx, col_idx, value):
    escaped_value = _escape_pipe(value)

    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_table = target_table.update_cell(row_idx, col_idx, escaped_value)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)


def insert_row(context, sheet_idx, table_idx, row_idx):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        # Create empty row with same length as headers
        empty_row = ["" for _ in target_table.headers]

        new_rows = list(target_table.rows)
        # Ensure row_idx is valid insertion point
        insert_pos = max(0, min(row_idx, len(new_rows)))
        new_rows.insert(insert_pos, empty_row)

        new_table = replace(target_table, rows=new_rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def delete_rows(context, sheet_idx, table_idx, row_indices):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_rows = list(target_table.rows)

        # Sort indices in descending order to avoid shifting issues when deleting
        for idx in sorted(row_indices, reverse=True):
            if 0 <= idx < len(new_rows):
                del new_rows[idx]

        new_table = replace(target_table, rows=new_rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def move_rows(context, sheet_idx, table_idx, row_indices, target_index):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        # Prepare for moving based on index tracking
        # We'll use the same logic as reorder_tab_metadata to map indices ideally,
        # or simplified list simulation since we have the full data in memory.

        current_rows = list(target_table.rows)

        # Identify rows to move
        rows_to_move = []
        for idx in sorted(set(row_indices)):
            if 0 <= idx < len(current_rows):
                rows_to_move.append((idx, current_rows[idx]))

        if not rows_to_move:
            return sheet

        # Remove rows from original list (in reverse order of index to keep indices valid during deletion)
        # We need to be careful with indices shifting.
        # Actually simplest way:
        # 1. Create list of (original_index, row) tuples
        # 2. Extract items to move
        # 3. Calculate target position relative to remaining items

        # Let's use the standard "pop and insert" approach but for multiple items.
        # Usually multiple selection move is handled by "cut" then "insert at new index".

        # Valid range for target_index is relative to the list *before* removal? Or after?
        # Standard UX: usually "insert BEFORE this index"

        # If we remove items first, the target index implies position in the *remaining* list.
        # But indices passed in are indices in implementation_plan list.

        # Strategy:
        # 1. Separate rows into "staying" and "moving"
        # 2. Re-construct structure

        staying_rows = []
        moving_rows_map = {r[0]: r[1] for r in rows_to_move}

        for i, row in enumerate(current_rows):
            if i not in moving_rows_map:
                staying_rows.append(row)

        # Determine insertion point
        # target_index is usually provided as an index in the ORIGINAL list where the drop occurred.
        # We need to map that to the index in 'staying_rows'.

        # Count how many staying rows are before target_index
        insert_idx_in_staying = 0
        for i in range(target_index):
            if i not in moving_rows_map:
                insert_idx_in_staying += 1

        # Insert moving rows
        to_insert = [r[1] for r in rows_to_move]

        final_rows = list(staying_rows)
        final_rows[insert_idx_in_staying:insert_idx_in_staying] = to_insert

        new_table = replace(target_table, rows=final_rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def _infer_column_type(rows, col_idx, metadata):
    # Check Metadata for explicit type
    visual = metadata.get("visual", {})
    if visual and "columns" in visual:
        col_meta = visual["columns"].get(str(col_idx))
        if col_meta and "type" in col_meta:
            return col_meta["type"]

    # Heuristic: Check if all non-empty values are numeric
    is_number = True
    has_value = False

    for row in rows:
        if col_idx >= len(row):
            continue
        val = row[col_idx].strip()
        if not val:
            continue

        has_value = True
        val_clean = val.replace(",", "")
        try:
            float(val_clean)
        except ValueError:
            is_number = False
            break

    if has_value and is_number:
        return "number"

    return "string"


def _get_sort_key(row, col_idx, col_type):
    val = ""
    if col_idx < len(row):
        val = row[col_idx]

    if col_type == "number":
        s = val.strip()
        if not s:
            return float("-inf")
        try:
            return float(s.replace(",", ""))
        except ValueError:
            return float("-inf")

    return val.lower()


def sort_rows(context, sheet_idx, table_idx, col_idx, ascending):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        rows = list(target_table.rows)
        metadata = target_table.metadata or {}

        col_type = _infer_column_type(rows, col_idx, metadata)

        rows.sort(
            key=lambda r: _get_sort_key(r, col_idx, col_type), reverse=not ascending
        )

        new_table = replace(target_table, rows=rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)
