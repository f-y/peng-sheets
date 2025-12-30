from dataclasses import replace

from md_spreadsheet_parser import Table

from .sheet import apply_sheet_update


def add_table(context, sheet_idx, column_names=None, table_name=None):
    if column_names is None:
        column_names = ["Column 1", "Column 2", "Column 3"]

    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        final_name = table_name or f"New Table {len(new_tables) + 1}"
        new_table = Table(
            name=final_name,
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


def update_table_metadata(context, sheet_idx, table_idx, new_name, new_description):
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_table = replace(target_table, name=new_name, description=new_description)
        new_tables[table_idx] = new_table
        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_transform)


def update_visual_metadata(context, sheet_idx, table_idx, visual_metadata):
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        metadata = dict(target_table.metadata or {})
        metadata["visual"] = visual_metadata

        new_table = replace(target_table, metadata=metadata)
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

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


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

        current_rows = list(target_table.rows)

        # Identify rows to move
        rows_to_move = []
        for idx in sorted(set(row_indices)):
            if 0 <= idx < len(current_rows):
                rows_to_move.append((idx, current_rows[idx]))

        if not rows_to_move:
            return sheet

        staying_rows = []
        moving_rows_map = {r[0]: r[1] for r in rows_to_move}

        for i, row in enumerate(current_rows):
            if i not in moving_rows_map:
                staying_rows.append(row)

        # Determine insertion point
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


def _shift_column_metadata(metadata, shift_map):
    """
    Shifts column-based metadata keys based on shift_map.
    shift_map: { old_index (int): new_index (int or None) }
    If new_index is None, the metadata for that column is removed.
    If an index is not in shift_map, it is assumed to be unchanged.
    """
    if not metadata:
        return {}

    new_metadata = dict(metadata)

    def shift_dict(source_dict):
        if not source_dict:
            return {}
        new_dict = {}

        # Separate column keys from others
        for k, v in source_dict.items():
            try:
                idx = int(k)
                # It is a column index
                if idx in shift_map:
                    new_idx = shift_map[idx]
                    if new_idx is not None:
                        new_dict[str(new_idx)] = v
                else:
                    new_dict[k] = v
            except ValueError:
                new_dict[k] = v
        return new_dict

    # 1. Validation (Direct, if valid)
    if "validation" in new_metadata:
        new_metadata["validation"] = shift_dict(new_metadata["validation"])

    # 2. Visual
    if "visual" in new_metadata:
        visual = dict(new_metadata["visual"])

        # Shift validation inside visual
        if "validation" in visual:
            visual["validation"] = shift_dict(visual["validation"])

        # Shift columns inside visual (e.g. width, align, format)
        if "columns" in visual:
            visual["columns"] = shift_dict(visual["columns"])

        # Shift filters inside visual
        if "filters" in visual:
            visual["filters"] = shift_dict(visual["filters"])

        new_metadata["visual"] = visual

    return new_metadata


def insert_column(context, sheet_idx, table_idx, col_idx, column_name="New Column"):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        # New header
        new_headers = list(target_table.headers)
        new_col_name = column_name
        # Ensure col_idx is within bounds
        insert_pos = max(0, min(col_idx, len(new_headers)))
        new_headers.insert(insert_pos, new_col_name)

        # New rows
        new_rows = []
        for row in target_table.rows:
            new_row = list(row)
            # Extend row if it's shorter than expected
            while len(new_row) < len(target_table.headers):
                new_row.append("")

            new_row.insert(insert_pos, "")
            new_rows.append(new_row)

        new_table = replace(target_table, headers=new_headers, rows=new_rows)

        # Shift Metadata
        # Everything >= col_idx shifts by +1
        col_count = len(target_table.headers)
        shift_map = {}
        for i in range(col_count):
            if i >= insert_pos:
                shift_map[i] = i + 1
            else:
                shift_map[i] = i

        if target_table.metadata:
            new_meta = _shift_column_metadata(target_table.metadata, shift_map)
            new_table = replace(new_table, metadata=new_meta)

        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def delete_columns(context, sheet_idx, table_idx, col_indices):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        sorted_indices = sorted(col_indices, reverse=True)

        new_headers = list(target_table.headers)
        for idx in sorted_indices:
            if 0 <= idx < len(new_headers):
                del new_headers[idx]

        new_rows = []
        for row in target_table.rows:
            new_row = list(row)
            # Align row length first
            while len(new_row) < len(target_table.headers):
                new_row.append("")

            for idx in sorted_indices:
                if 0 <= idx < len(new_row):
                    del new_row[idx]
            new_rows.append(new_row)

        new_table = replace(target_table, headers=new_headers, rows=new_rows)

        # Metadata Shift
        # Indices in sorted_indices are removed (None)
        # Indices > removed shift down
        # Need to calculate final map efficiently
        # Since we can delete multiple non-contiguous, recalculate map based on survival

        shift_map = {}
        deleted_set = set(sorted_indices)
        col_count = len(target_table.headers)

        target_pos = 0
        for i in range(col_count):
            if i in deleted_set:
                shift_map[i] = None
            else:
                shift_map[i] = target_pos
                target_pos += 1

        if target_table.metadata:
            new_meta = _shift_column_metadata(target_table.metadata, shift_map)
            new_table = replace(new_table, metadata=new_meta)

        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def move_columns(context, sheet_idx, table_idx, col_indices, target_index):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        headers = list(target_table.headers)
        rows = [list(r) for r in target_table.rows]  # Copy rows

        # Helper to reorder a list
        def reorder_list(items):
            moving_items_map = {}
            for idx in sorted(set(col_indices)):
                if 0 <= idx < len(items):
                    moving_items_map[idx] = items[idx]

            if not moving_items_map:
                return items

            staying_items = []
            for i, item in enumerate(items):
                if i not in moving_items_map:
                    staying_items.append(item)

            insert_idx_in_staying = 0
            for i in range(target_index):
                if i not in moving_items_map:
                    insert_idx_in_staying += 1

            # Map back to ordered list of moving items based on input order?
            # Usually move logic expects input order or sorted order.
            # Let's assume sorted order for stability.
            moving_items = [
                moving_items_map[idx] for idx in sorted(moving_items_map.keys())
            ]

            final_items = list(staying_items)
            final_items[insert_idx_in_staying:insert_idx_in_staying] = moving_items
            return final_items

        new_headers = reorder_list(headers)
        new_rows = []
        for row in rows:
            # Ensure row is full length
            while len(row) < len(headers):
                row.append("")
            new_rows.append(reorder_list(row))

        new_table = replace(target_table, headers=new_headers, rows=new_rows)

        # Metadata Shift for Move
        # We need to compute mapping from Old -> New index
        # Reusing the reorder logic to build a map?

        # Reconstruct the map:
        cols_indices = list(range(len(headers)))
        new_indices = reorder_list(
            cols_indices
        )  # This gives [old_idx_at_pos_0, old_idx_at_pos_1, ...]

        # We need { old_idx: new_pos }
        shift_map = {}
        for new_pos, old_idx in enumerate(new_indices):
            shift_map[old_idx] = new_pos

        if target_table.metadata:
            new_meta = _shift_column_metadata(target_table.metadata, shift_map)
            new_table = replace(new_table, metadata=new_meta)

        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def clear_columns(context, sheet_idx, table_idx, col_indices):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_rows = []
        indices_set = set(col_indices)

        for row in target_table.rows:
            new_row = list(row)
            for i in range(len(new_row)):
                if i in indices_set:
                    new_row[i] = ""
            new_rows.append(new_row)

        new_table = replace(target_table, rows=new_rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def _update_column_metadata(table, col_idx, key, value):
    """Helper to update column metadata correctly."""
    metadata = dict(table.metadata or {})
    visual = dict(metadata.get("visual", {}))
    columns = dict(visual.get("columns", {}))

    col_str = str(col_idx)
    col_meta = dict(columns.get(col_str, {}))

    col_meta[key] = value
    columns[col_str] = col_meta
    visual["columns"] = columns
    metadata["visual"] = visual

    return replace(table, metadata=metadata)


def update_column_width(context, sheet_idx, table_idx, col_idx, width):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_table = _update_column_metadata(target_table, col_idx, "width", width)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def update_column_format(context, sheet_idx, table_idx, col_idx, fmt):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_table = _update_column_metadata(target_table, col_idx, "format", fmt)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def update_column_filter(context, sheet_idx, table_idx, col_idx, hidden_values):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        metadata = dict(target_table.metadata or {})
        visual = dict(metadata.get("visual", {}))
        filters = dict(visual.get("filters", {}))

        filters[str(col_idx)] = hidden_values
        visual["filters"] = filters
        metadata["visual"] = visual

        new_table = replace(target_table, metadata=metadata)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def update_column_align(context, sheet_idx, table_idx, col_idx, align):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        # alignments is either None or list of strings
        alignments = list(target_table.alignments) if target_table.alignments else []

        # ensure list is long enough
        num_cols = len(target_table.headers)
        while len(alignments) < num_cols:
            alignments.append(
                "left"
            )  # default? or None? Parser usually uses 'left', 'center', 'right', or None.
            # If alignments was None, we are creating it.
            # GFM defaults to left/none.

        if 0 <= col_idx < len(alignments):
            alignments[col_idx] = align

        new_table = replace(target_table, alignments=alignments)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def paste_cells(
    context, sheet_idx, table_idx, start_row, start_col, new_data, include_headers=False
):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        paste_data = list(new_data)
        new_headers = list(target_table.headers) if target_table.headers else []

        # Handle headers from first row of paste data
        if include_headers and len(paste_data) > 0:
            header_row = paste_data[0]
            paste_data = paste_data[1:]  # Remaining rows are data

            # Update headers from first row, starting at start_col
            for c_offset, val in enumerate(header_row):
                target_c = start_col + c_offset
                while len(new_headers) <= target_c:
                    new_headers.append(f"Col {len(new_headers) + 1}")
                new_headers[target_c] = val

        current_rows = [list(r) for r in target_table.rows]
        rows_to_paste = len(paste_data)
        if rows_to_paste == 0 and not include_headers:
            return sheet

        # Max columns in pasted data
        cols_to_paste = 0
        for row in paste_data:
            cols_to_paste = max(cols_to_paste, len(row))

        # 1. Expand Rows
        needed_rows = start_row + rows_to_paste
        # Determine width for new empty rows
        base_width = len(new_headers) if new_headers else 0
        if current_rows:
            base_width = max(base_width, len(current_rows[0]))

        while len(current_rows) < needed_rows:
            current_rows.append([""] * base_width)

        # 2. Update Data & Expand Columns if needed
        max_cols_needed = start_col + cols_to_paste

        for r_offset, row_data in enumerate(paste_data):
            target_r = start_row + r_offset

            # Expand this row's columns
            while len(current_rows[target_r]) < max_cols_needed:
                current_rows[target_r].append("")

            for c_offset, val in enumerate(row_data):
                target_c = start_col + c_offset
                current_rows[target_r][target_c] = _escape_pipe(val)

        # 3. Homogenize row lengths and headers
        global_max_width = 0
        for r in current_rows:
            global_max_width = max(global_max_width, len(r))

        if new_headers:
            global_max_width = max(global_max_width, len(new_headers))

        # Pad all rows
        for r in current_rows:
            if len(r) < global_max_width:
                r.extend([""] * (global_max_width - len(r)))

        # Pad headers
        if new_headers:
            while len(new_headers) < global_max_width:
                new_headers.append(f"Col {len(new_headers) + 1}")

        new_table = replace(target_table, headers=new_headers, rows=current_rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)


def move_cells(context, sheet_idx, table_idx, src_range, dest_row, dest_col):
    def sheet_update_logic(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]

        min_r = src_range["minR"]
        max_r = src_range["maxR"]
        min_c = src_range["minC"]
        max_c = src_range["maxC"]

        # Check for no-op (same position)
        if min_r == dest_row and min_c == dest_col:
            return sheet

        current_rows = [list(r) for r in target_table.rows]

        # Extract source data
        src_data = []
        for r in range(min_r, max_r + 1):
            row_data = []
            for c in range(min_c, max_c + 1):
                if r < len(current_rows) and c < len(current_rows[r]):
                    row_data.append(current_rows[r][c])
                else:
                    row_data.append("")
            src_data.append(row_data)

        height = max_r - min_r + 1
        width = max_c - min_c + 1

        # Expand grid if needed for destination
        needed_rows = dest_row + height
        num_cols = (
            len(target_table.headers)
            if target_table.headers
            else (len(current_rows[0]) if current_rows else 0)
        )
        needed_cols = dest_col + width

        while len(current_rows) < needed_rows:
            current_rows.append([""] * num_cols)

        for row in current_rows:
            while len(row) < needed_cols:
                row.append("")

        # Clear source cells (after extraction, before paste to handle overlaps correctly)
        for r in range(min_r, max_r + 1):
            for c in range(min_c, max_c + 1):
                if r < len(current_rows) and c < len(current_rows[r]):
                    current_rows[r][c] = ""

        # Write to destination
        for r_offset, row_data in enumerate(src_data):
            for c_offset, val in enumerate(row_data):
                target_r = dest_row + r_offset
                target_c = dest_col + c_offset
                current_rows[target_r][target_c] = val

        new_table = replace(target_table, rows=current_rows)
        new_tables[table_idx] = new_table

        return replace(sheet, tables=new_tables)

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)
