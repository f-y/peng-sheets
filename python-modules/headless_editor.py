import json
from dataclasses import replace

# Global State (managed by the
# State is now managed by md_spreadsheet_editor.context.EditorContext
from md_spreadsheet_editor.context import EditorContext
from md_spreadsheet_editor.services import workbook as workbook_service
from md_spreadsheet_parser import (
    MultiTableParsingSchema,
    Sheet,
    Workbook,
    generate_workbook_markdown,
    parse_workbook,
)
from md_spreadsheet_parser.models import Table


def apply_workbook_update(transform_func):
    ctx = EditorContext()
    # Sync global workbook to context if changed (e.g. by tests)
    global workbook, md_text
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = workbook_service.update_workbook(ctx, transform_func)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def apply_sheet_update(sheet_idx, transform_func):
    ctx = EditorContext()
    # Sync global workbook to context if changed (e.g. by tests)
    global workbook, md_text
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = workbook_service.apply_sheet_update(ctx, sheet_idx, transform_func)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def apply_table_update(sheet_idx, table_idx, transform_func):
    # We might need to implement apply_table_update in services later or custom here
    # For now, let's implement it here using apply_sheet_update
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        target_table = new_tables[table_idx]
        new_table = transform_func(target_table)
        new_tables[table_idx] = new_table
        return replace(sheet, tables=new_tables)

    return apply_sheet_update(sheet_idx, sheet_transform)


def get_workbook_range(md_text, root_marker, sheet_header_level):
    # This logic is duplicated in services/workbook.py but keeps legacy here for now if needed locally
    # Ideally should use workbook_service version if possible or just keep utility
    return workbook_service.get_workbook_range(md_text, root_marker, sheet_header_level)


def generate_and_get_range():
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)
    return workbook_service.generate_and_get_range(ctx)


# Shimmed functions using new package structure
import md_spreadsheet_editor.api as new_api


def add_sheet(
    new_name, column_names=None, after_sheet_index=None, target_tab_order_index=None
):
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.add_sheet(
        new_name, column_names, after_sheet_index, target_tab_order_index
    )

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def delete_sheet(sheet_idx):
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.delete_sheet(sheet_idx)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def rename_sheet(sheet_idx, new_name):
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.rename_sheet(sheet_idx, new_name)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def move_sheet(from_index, to_index, target_tab_order_index=None):
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.move_sheet(from_index, to_index, target_tab_order_index)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def add_table(sheet_idx, column_names=None):
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.add_table(sheet_idx, column_names)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def delete_table(sheet_idx, table_idx):
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.delete_table(sheet_idx, table_idx)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def rename_table(sheet_idx, table_idx, new_name):
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.rename_table(sheet_idx, table_idx, new_name)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def update_workbook_tab_order(tab_order):
    """
    Update the tab display order in workbook metadata.

    Args:
        tab_order: List of dicts describing tab order, e.g.:
            [
                {"type": "document", "index": 0},
                {"type": "sheet", "index": 0},
                {"type": "sheet", "index": 1},
                {"type": "document", "index": 1}
            ]

    Returns:
        dict with 'content', 'startLine', 'endLine' or 'error' if failed
    """

    def wb_transform(wb):
        current_metadata = dict(wb.metadata) if wb.metadata else {}
        current_metadata["tab_order"] = tab_order
        return replace(wb, metadata=current_metadata)

    return apply_workbook_update(wb_transform)


def update_sheet_metadata(sheet_idx, metadata):
    return apply_sheet_update(sheet_idx, lambda s: replace(s, metadata=metadata))


def update_table_metadata(sheet_idx, table_idx, new_name, new_desc):
    return apply_table_update(
        sheet_idx, table_idx, lambda t: replace(t, name=new_name, description=new_desc)
    )


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


def update_cell(sheet_idx, table_idx, row_idx, col_idx, value):
    escaped_value = _escape_pipe(value)
    return apply_table_update(
        sheet_idx, table_idx, lambda t: t.update_cell(row_idx, col_idx, escaped_value)
    )


def delete_row(sheet_idx, table_idx, row_idx):
    return apply_table_update(sheet_idx, table_idx, lambda t: t.delete_row(row_idx))


def delete_rows(sheet_idx, table_idx, row_indices):
    def _delete_logic(t):
        # Sort indices in descending order to prevent index shifting issues
        sorted_indices = sorted(row_indices, reverse=True)
        current_table = t
        for idx in sorted_indices:
            current_table = current_table.delete_row(idx)
        return current_table

    return apply_table_update(sheet_idx, table_idx, _delete_logic)


def _shift_column_metadata_indices(metadata, col_idx, direction):
    """
    Shift column-indexed metadata when columns are inserted or deleted.

    Args:
        metadata: Table metadata dict
        col_idx: Column index where operation occurred
        direction: +1 for insert (shift right), -1 for delete (shift left)

    Returns:
        Updated metadata dict
    """
    if not metadata:
        return metadata

    new_metadata = metadata.copy()
    visual = new_metadata.get("visual", {})
    if not visual:
        return new_metadata

    new_visual = visual.copy()
    updated = False

    # Keys in visual that use column index as key
    column_indexed_keys = ["column_widths", "validation", "columns", "filters"]

    for key in column_indexed_keys:
        if key not in new_visual:
            continue

        old_data = new_visual[key]
        if not isinstance(old_data, dict):
            continue

        new_data = {}
        for str_idx, value in old_data.items():
            try:
                idx = int(str_idx)
            except (ValueError, TypeError):
                # Keep non-integer keys as-is
                new_data[str_idx] = value
                continue

            if direction == -1:  # Delete
                if idx == col_idx:
                    # This column is being deleted, skip it
                    updated = True
                    continue
                elif idx > col_idx:
                    # Shift left
                    new_data[str(idx - 1)] = value
                    updated = True
                else:
                    # Keep as-is
                    new_data[str_idx] = value
            else:  # Insert (direction == +1)
                if idx >= col_idx:
                    # Shift right
                    new_data[str(idx + 1)] = value
                    updated = True
                else:
                    # Keep as-is
                    new_data[str_idx] = value

        new_visual[key] = new_data

    if updated:
        new_metadata["visual"] = new_visual

    return new_metadata


def delete_column(sheet_idx, table_idx, col_idx):
    def _delete_with_metadata(t):
        new_table = t.delete_column(col_idx)
        new_metadata = _shift_column_metadata_indices(new_table.metadata, col_idx, -1)
        return replace(new_table, metadata=new_metadata)

    return apply_table_update(sheet_idx, table_idx, _delete_with_metadata)


def delete_columns(sheet_idx, table_idx, col_indices):
    def _delete_logic(t):
        # Sort indices in descending order to prevent index shifting issues
        sorted_indices = sorted(col_indices, reverse=True)
        current_table = t
        for idx in sorted_indices:
            current_table = current_table.delete_column(idx)
            # Shift metadata for each deletion.
            # Since we modify current_table.metadata in place via _shift_column_metadata_indices
            # (which technically creates a new dict), we need to update current_table repeatedly.
            new_metadata = _shift_column_metadata_indices(
                current_table.metadata, idx, -1
            )
            current_table = replace(current_table, metadata=new_metadata)
        return current_table

    return apply_table_update(sheet_idx, table_idx, _delete_logic)


def clear_column(sheet_idx, table_idx, col_idx):
    def _clear_logic(t):
        new_rows = []
        for row in t.rows:
            new_r = list(row)
            if 0 <= col_idx < len(new_r):
                new_r[col_idx] = ""
            new_rows.append(new_r)
        return replace(t, rows=new_rows)

    return apply_table_update(sheet_idx, table_idx, _clear_logic)


def clear_columns(sheet_idx, table_idx, col_indices):
    def _clear_logic(t):
        new_rows = []
        for row in t.rows:
            new_r = list(row)
            for col_idx in col_indices:
                if 0 <= col_idx < len(new_r):
                    new_r[col_idx] = ""
            new_rows.append(new_r)
        return replace(t, rows=new_rows)

    return apply_table_update(sheet_idx, table_idx, _clear_logic)


def insert_row(sheet_idx, table_idx, row_idx):
    return apply_table_update(sheet_idx, table_idx, lambda t: t.insert_row(row_idx))


def insert_column(sheet_idx, table_idx, col_idx):
    def _insert_with_metadata(t):
        new_table = t.insert_column(col_idx)
        new_metadata = _shift_column_metadata_indices(new_table.metadata, col_idx, +1)
        return replace(new_table, metadata=new_metadata)

    return apply_table_update(sheet_idx, table_idx, _insert_with_metadata)


def update_visual_metadata(sheet_idx, table_idx, visual_metadata):
    def _update_logic(t):
        current_md = t.metadata or {}
        new_md = current_md.copy()

        current_visual = new_md.get("visual", {})
        updated_visual = current_visual.copy()
        updated_visual.update(visual_metadata)

        new_md["visual"] = updated_visual
        return replace(t, metadata=new_md)

    return apply_table_update(sheet_idx, table_idx, _update_logic)


def paste_cells(
    sheet_idx, table_idx, start_row, start_col, new_data, include_headers=False
):
    def _paste_logic(t):
        paste_data = list(new_data)
        new_headers = list(t.headers) if t.headers else []

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

        current_rows = [list(r) for r in t.rows]
        rows_to_paste = len(paste_data)
        if rows_to_paste == 0 and not include_headers:
            return t

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

        # If rows_to_paste was 0 but we updated headers, still return updated table
        return replace(t, rows=current_rows, headers=new_headers)

    return apply_table_update(sheet_idx, table_idx, _paste_logic)


def move_rows(sheet_idx, table_idx, row_indices, target_row_idx):
    """
    Move selected rows to a new position.

    Args:
        sheet_idx: Sheet index
        table_idx: Table index
        row_indices: List of row indices to move (0-based)
        target_row_idx: Target position to insert rows (0-based, before adjustment)

    Returns:
        IUpdateSpec with the changes
    """

    def _move_logic(t):
        if not row_indices:
            return t

        current_rows = [list(r) for r in t.rows]
        num_rows = len(current_rows)

        # Validate indices
        sorted_indices = sorted(row_indices)
        for idx in sorted_indices:
            if idx < 0 or idx >= num_rows:
                raise IndexError(f"Invalid row index: {idx}")

        # Check if move is a no-op (moving to the same position)
        # This happens when target is within the contiguous range being moved
        min_idx = sorted_indices[0]
        max_idx = sorted_indices[-1]
        if target_row_idx >= min_idx and target_row_idx <= max_idx + 1:
            # Check if indices are contiguous
            if sorted_indices == list(range(min_idx, max_idx + 1)):
                return t

        # Extract rows to move
        rows_to_move = [current_rows[i] for i in sorted_indices]

        # Remove rows from original positions (in reverse to preserve indices)
        for idx in reversed(sorted_indices):
            del current_rows[idx]

        # Adjust target index based on how many rows were removed before it
        removed_before_target = sum(1 for idx in sorted_indices if idx < target_row_idx)
        adjusted_target = target_row_idx - removed_before_target

        # Insert rows at adjusted target position
        for i, row in enumerate(rows_to_move):
            current_rows.insert(adjusted_target + i, row)

        return replace(t, rows=current_rows)

    return apply_table_update(sheet_idx, table_idx, _move_logic)


def _reorder_column_metadata(metadata, col_indices, target_col_idx):
    """
    Reorder column-indexed metadata when columns are moved.

    Args:
        metadata: Table metadata dict
        col_indices: List of column indices being moved
        target_col_idx: Target position

    Returns:
        Updated metadata dict
    """
    if not metadata:
        return metadata

    new_metadata = metadata.copy()

    # Handle both legacy 'columnWidths' and 'visual' nested structure
    # Legacy: metadata["columnWidths"] = {"0": 100, "1": 150}
    # New: metadata["visual"]["column_widths"] = {"0": 100, "1": 150}

    def reorder_dict(old_data, col_indices, target_col_idx):
        """Reorder a dict with string column indices as keys."""
        if not isinstance(old_data, dict):
            return old_data

        # Convert to list format for easier manipulation
        max_idx = 0
        for str_idx in old_data.keys():
            try:
                max_idx = max(max_idx, int(str_idx))
            except (ValueError, TypeError):
                pass

        # Create ordered list (None for missing indices)
        values_list = [old_data.get(str(i)) for i in range(max_idx + 1)]

        # Extract values being moved
        sorted_indices = sorted(col_indices)
        values_to_move = [
            values_list[i] if i < len(values_list) else None for i in sorted_indices
        ]

        # Remove from original positions (reverse order)
        for idx in reversed(sorted_indices):
            if idx < len(values_list):
                values_list[idx] = "__REMOVE__"
        values_list = [v for v in values_list if v != "__REMOVE__"]

        # Adjust target
        removed_before_target = sum(1 for idx in sorted_indices if idx < target_col_idx)
        adjusted_target = target_col_idx - removed_before_target

        # Insert at target
        for i, val in enumerate(values_to_move):
            values_list.insert(adjusted_target + i, val)

        # Convert back to dict format
        new_data = {}
        for i, val in enumerate(values_list):
            if val is not None:
                new_data[str(i)] = val

        return new_data

    # Handle legacy columnWidths
    if "columnWidths" in new_metadata:
        new_metadata["columnWidths"] = reorder_dict(
            new_metadata["columnWidths"], col_indices, target_col_idx
        )

    # Handle visual nested structure
    if "visual" in new_metadata:
        visual = new_metadata["visual"].copy()
        for key in ["column_widths", "validation", "columns", "filters"]:
            if key in visual:
                visual[key] = reorder_dict(visual[key], col_indices, target_col_idx)
        new_metadata["visual"] = visual

    return new_metadata


def move_columns(sheet_idx, table_idx, col_indices, target_col_idx):
    """
    Move selected columns to a new position.

    Args:
        sheet_idx: Sheet index
        table_idx: Table index
        col_indices: List of column indices to move (0-based)
        target_col_idx: Target position to insert columns (0-based)

    Returns:
        IUpdateSpec with the changes
    """

    def _move_logic(t):
        if not col_indices:
            return t

        headers = list(t.headers) if t.headers else []
        num_cols = len(headers)

        # Validate indices
        sorted_indices = sorted(col_indices)
        for idx in sorted_indices:
            if idx < 0 or idx >= num_cols:
                raise IndexError(f"Invalid column index: {idx}")

        # Check if move is a no-op
        min_idx = sorted_indices[0]
        max_idx = sorted_indices[-1]
        if target_col_idx >= min_idx and target_col_idx <= max_idx + 1:
            if sorted_indices == list(range(min_idx, max_idx + 1)):
                return t

        # Extract headers to move
        headers_to_move = [headers[i] for i in sorted_indices]

        # Remove from original positions (reverse order)
        for idx in reversed(sorted_indices):
            del headers[idx]

        # Adjust target
        removed_before_target = sum(1 for idx in sorted_indices if idx < target_col_idx)
        adjusted_target = target_col_idx - removed_before_target

        # Insert at target
        for i, header in enumerate(headers_to_move):
            headers.insert(adjusted_target + i, header)

        # Move data in each row
        new_rows = []
        for row in t.rows:
            row_list = list(row)

            # Pad row if necessary
            while len(row_list) < num_cols:
                row_list.append("")

            # Extract cells to move
            cells_to_move = [row_list[i] for i in sorted_indices]

            # Remove from original positions
            for idx in reversed(sorted_indices):
                del row_list[idx]

            # Insert at target
            for i, cell in enumerate(cells_to_move):
                row_list.insert(adjusted_target + i, cell)

            new_rows.append(row_list)

        # Reorder column metadata
        new_metadata = _reorder_column_metadata(
            t.metadata, sorted_indices, target_col_idx
        )

        return replace(t, headers=headers, rows=new_rows, metadata=new_metadata)

    return apply_table_update(sheet_idx, table_idx, _move_logic)


def move_cells(sheet_idx, table_idx, src_range, dest_row, dest_col):
    """
    Move a cell range to a new position (clear source, overwrite destination).

    Args:
        sheet_idx: Sheet index
        table_idx: Table index
        src_range: Dict with minR, maxR, minC, maxC (0-based)
        dest_row: Destination top-left row (0-based)
        dest_col: Destination top-left column (0-based)

    Returns:
        IUpdateSpec with the changes
    """

    def _move_logic(t):
        min_r = src_range["minR"]
        max_r = src_range["maxR"]
        min_c = src_range["minC"]
        max_c = src_range["maxC"]

        # Check for no-op (same position)
        if min_r == dest_row and min_c == dest_col:
            return t

        current_rows = [list(r) for r in t.rows]

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
            len(t.headers)
            if t.headers
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

        return replace(t, rows=current_rows)

    return apply_table_update(sheet_idx, table_idx, _move_logic)


def augment_workbook_metadata(workbook_dict, md_text, root_marker, sheet_header_level):
    lines = md_text.split("\n")

    # Find root marker first to replicate parse_workbook skip logic
    start_index = 0
    in_code_block = False

    if root_marker:
        for i, line in enumerate(lines):
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
            if not in_code_block and line.strip() == root_marker:
                start_index = i + 1
                break

    header_prefix = "#" * sheet_header_level + " "

    current_sheet_idx = 0

    # Simple scan for sheet headers
    # We assume parse_workbook found them in order.
    # Reset in_code_block for the second pass?
    # If we broke at start_index, we know start_index-1 was the root marker (not in code block).
    # So start_index starts with in_code_block=False (unless the line itself is ```?)
    in_code_block = False

    for idx, line in enumerate(lines[start_index:], start=start_index):
        stripped = line.strip()

        if stripped.startswith("```"):
            in_code_block = not in_code_block

        if in_code_block:
            continue

        # Check for higher-level headers that would break workbook parsing
        if stripped.startswith("#"):
            level = 0
            for char in stripped:
                if char == "#":
                    level += 1
                else:
                    break
            if level < sheet_header_level:
                break

        if stripped.startswith(header_prefix):
            if current_sheet_idx < len(workbook_dict["sheets"]):
                workbook_dict["sheets"][current_sheet_idx]["header_line"] = idx
                current_sheet_idx += 1
            else:
                break

    return workbook_dict


def extract_structure(md_text, root_marker):
    sections = []
    lines = md_text.split("\n")
    current_type = None
    current_title = None
    current_lines = []

    in_code_block = False

    for line in lines:
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block and line.startswith("# ") and not line.startswith("##"):
            if current_title and current_type == "document":
                sections.append(
                    {
                        "type": "document",
                        "title": current_title,
                        "content": "\n".join(current_lines),
                    }
                )

            stripped = line.strip()
            if stripped == root_marker:
                sections.append({"type": "workbook"})
                current_title = None
                current_type = "workbook"
            else:
                current_title = line[2:].strip()
                current_type = "document"

            current_lines = []
        else:
            if current_type == "document":
                current_lines.append(line)

    if current_title and current_type == "document":
        sections.append(
            {
                "type": "document",
                "title": current_title,
                "content": "\n".join(current_lines),
            }
        )

    return json.dumps(sections)


def get_document_section_range(wb, section_index):
    """Get the start and end line numbers for a document section.

    Args:
        wb: Workbook instance (unused, but matches call pattern)
        section_index: Index of the section in the structure (0-based)

    Returns:
        dict with 'start_line' and 'end_line', or 'error' if not found
    """
    return new_api.get_document_section_range(section_index)


def add_document(
    title, after_doc_index=-1, after_workbook=False, insert_after_tab_order_index=-1
):
    """
    Add a new document section to the markdown.

    Args:
        title: Title for the new document (# Title)
        after_doc_index: Insert after this document index (-1 for beginning)
        after_workbook: If True, insert after the workbook section
        insert_after_tab_order_index: Position in tab_order to insert after (-1 = append)

    Returns:
        dict with 'content', 'startLine', 'endLine', 'file_changed' or 'error'
    """
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.add_document(
        title, after_doc_index, after_workbook, insert_after_tab_order_index
    )

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def rename_document(doc_index, new_title):
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.rename_document(doc_index, new_title)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def delete_document(doc_index):
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.delete_document(doc_index)

    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def delete_document_and_get_full_update(doc_index):
    # Sync globals to context
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.delete_document_and_get_full_update(doc_index)

    # Sync back
    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def add_document_and_get_full_update(
    title, after_doc_index=-1, after_workbook=False, insert_after_tab_order_index=-1
):
    # Sync globals to context
    ctx = EditorContext()
    global md_text, workbook
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.add_document_and_get_full_update(
        title, after_doc_index, after_workbook, insert_after_tab_order_index
    )

    # Sync back
    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def move_document_section(
    from_doc_index,
    to_doc_index=None,
    to_after_workbook=False,
    to_before_workbook=False,
    target_tab_order_index=None,
):
    # Sync globals to context
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.move_document_section(
        from_doc_index,
        to_doc_index,
        to_after_workbook,
        to_before_workbook,
        target_tab_order_index,
    )

    # Sync back
    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def move_workbook_section(
    to_doc_index=None,
    to_after_doc=False,
    to_before_doc=False,
    target_tab_order_index=None,
):
    # Sync globals to context
    ctx = EditorContext()
    global md_text, workbook
    ctx.update_state(md_text=md_text)
    if workbook is not ctx.workbook:
        ctx.update_workbook(workbook)

    result = new_api.move_workbook_section(
        to_doc_index,
        to_after_doc,
        to_before_doc,
        target_tab_order_index,
    )

    # Sync back
    md_text = ctx.md_text
    workbook = ctx.workbook
    return result


def _reorder_tab_metadata(wb, item_type, from_idx, to_idx, target_tab_order_index):
    """
    Updates tab_order metadata after a physical move of a sheet or document.
    1. Updates 'index' property of all items of `item_type`.
    2. Moves the item in the `tab_order` list to `target_tab_order_idx`.
    """
    if not wb or not wb.metadata:
        return wb

    metadata = dict(wb.metadata)
    tab_order = list(metadata.get("tab_order", []))

    if not tab_order:
        return wb

    # 1. Update indices based on physical move
    # Logic matches python list behavior: pop(from), insert(to)
    # So indices shift.

    # Calculate shift for items of the same type
    # If from < to: items between from+1 and to get -1 (they move 'up' to fill gap)
    # If from > to: items between to and from-1 get +1 (they move 'down' to make room)

    # Note: to_idx logic in move_sheet/move_doc might differ slightly on boundary condition ("before" vs "after")
    # In move_sheet: insert_idx = max(0, min(to_index, len(new_sheets))) -> this is index in LIST *after* pop.

    # We need to apply this index mapping to all items in tab_order

    # We assume valid range from caller

    # Effective insertion index behavior
    # If moving 0 to 2 (list size 3: A,B,C -> B,C,A)
    # A becomes 2. B(1)->0. C(2)->1.

    # Map old_index -> new_index

    # Count total items of this type

    # It's easier to simulate the list move to generate the map
    # Create list of indices [0, 1, 2, ...]
    # Perform the move
    # record where each number ended up.

    # We need to know COUNT of items of item_type to create the dummy list.
    # We can infer max index from tab_order, or just assume we only care about those present in tab_order.

    indices_in_tab_order = [
        item["index"] for item in tab_order if item["type"] == item_type
    ]
    if not indices_in_tab_order:
        return wb

    max_index = max(indices_in_tab_order)
    # Safety: if from_idx is out of current range, extend
    max_index = max(max_index, from_idx)
    # Note: to_idx can be max_index + 1 to indicate "end position"
    # But for the dummy list, we only need indices that actually exist
    # Clamp to_idx to the valid range for insertion (0 <= to_idx <= max_index)
    clamped_to_idx = min(to_idx, max_index)

    # Create dummy list representing physical positions
    # item at index i holds the original index 'i'
    dummy_list = list(range(max_index + 1))

    if from_idx < len(dummy_list):
        moved_item = dummy_list.pop(from_idx)
        # clamp insert position
        insert_idx = max(0, min(clamped_to_idx, len(dummy_list)))
        dummy_list.insert(insert_idx, moved_item)

    # New position in dummy_list is 'p', value is 'old_index'
    # So item that WAS at 'old_index' is NOW at 'p'.
    # We want: given 'old_index' in tab_order, what is 'new_index'?
    # new_index = dummy_list.index(old_index)

    new_index_map = {old: new for new, old in enumerate(dummy_list)}

    # Apply index updates
    moved_tab_order_item = None

    for item in tab_order:
        if item["type"] == item_type:
            old_idx = item["index"]
            if old_idx in new_index_map:
                item["index"] = new_index_map[old_idx]

            # Identify the moved item within tab_order to re-position it in the list
            # We track it by the NEW index (which matches the one at insert_idx)
            # Wait, easier: identify by original index (which we know is from_idx)
            if old_idx == from_idx:
                moved_tab_order_item = item

    # 2. Reorder the tab_order list itself
    # Move 'moved_tab_order_item' to 'target_tab_order_idx'
    if moved_tab_order_item and target_tab_order_index is not None:
        # Remove from current position
        try:
            curr_pos = tab_order.index(moved_tab_order_item)
            tab_order.pop(curr_pos)

            # Insert at target
            # Clamp target
            safe_target = max(0, min(target_tab_order_index, len(tab_order)))
            tab_order.insert(safe_target, moved_tab_order_item)
        except ValueError:
            pass  # Should not happen
        metadata["tab_order"] = tab_order
    return replace(wb, metadata=metadata)


def initialize_workbook(md_text_input, config_json):
    global md_text, config, workbook
    md_text = md_text_input
    config = config_json
    # Delegate to new API/Context
    result = new_api.initialize_workbook(md_text_input, config_json)

    # Sync workbook global from context
    ctx = new_api.EditorContext()
    workbook = ctx.workbook
    return result


def get_state():
    ctx = EditorContext()
    global workbook, md_text
    # Sync global workbook change (e.g. workbook = None in tests)
    if workbook is not ctx.workbook:
        ctx.workbook = workbook
    return new_api.get_state()


def get_full_markdown():
    """Return the full markdown content including all updates."""
    global md_text
    return md_text


def update_column_width(sheet_idx, table_idx, col_idx, width):
    def _update_logic(t):
        current_md = t.metadata or {}
        new_md = current_md.copy()

        current_visual = new_md.get("visual", {})
        updated_visual = current_visual.copy()

        # Deep merge/update column_widths
        current_widths = updated_visual.get("column_widths", {})
        updated_widths = current_widths.copy()
        updated_widths[str(col_idx)] = width

        updated_visual["column_widths"] = updated_widths
        new_md["visual"] = updated_visual

        return replace(t, metadata=new_md)

    return apply_table_update(sheet_idx, table_idx, _update_logic)


def update_column_filter(sheet_idx, table_idx, col_idx, hidden_values):
    def _update_logic(t):
        current_md = t.metadata or {}
        new_md = current_md.copy()

        current_visual = new_md.get("visual", {})
        updated_visual = current_visual.copy()

        # Deep merge/update filters
        current_filters = updated_visual.get("filters", {})
        updated_filters = current_filters.copy()
        updated_filters[str(col_idx)] = hidden_values

        updated_visual["filters"] = updated_filters
        new_md["visual"] = updated_visual

        return replace(t, metadata=new_md)

    return apply_table_update(sheet_idx, table_idx, _update_logic)


def update_column_align(sheet_idx, table_idx, col_idx, alignment):
    """Update GFM alignment for a specific column.

    Updates table.alignments directly instead of metadata.
    """

    def _update_logic(t):
        current_alignments = list(t.alignments) if t.alignments else []

        # Extend if needed
        while len(current_alignments) <= col_idx:
            current_alignments.append("default")

        current_alignments[col_idx] = alignment if alignment else "default"
        return replace(t, alignments=current_alignments)

    return apply_table_update(sheet_idx, table_idx, _update_logic)


def _infer_column_type(rows, col_idx, metadata):
    # 1. Check Metadata for explicit type
    # We look in 'visual' -> 'columns' for now as that's where we store it in tests
    visual = metadata.get("visual", {})
    if visual and "columns" in visual:
        col_meta = visual["columns"].get(str(col_idx))
        if col_meta and "type" in col_meta:
            return col_meta["type"]

    # 2. Heuristic: Check if all non-empty values are numeric (allowing for commas)
    is_number = True
    has_value = False

    for row in rows:
        if col_idx >= len(row):
            continue
        val = row[col_idx].strip()
        if not val:
            continue

        has_value = True
        # Simple check: remove commas and generic whitespace
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


def sort_rows(sheet_idx, table_idx, col_idx, ascending):
    def _sort_logic(t):
        rows = list(t.rows)
        metadata = t.metadata or {}

        # Determine column type
        col_type = _infer_column_type(rows, col_idx, metadata)

        # Sort
        rows.sort(
            key=lambda r: _get_sort_key(r, col_idx, col_type), reverse=not ascending
        )
        return replace(t, rows=rows)

    return apply_table_update(sheet_idx, table_idx, _sort_logic)


def update_column_format(sheet_idx, table_idx, col_idx, format_config):
    """Update the display format settings for a specific column.

    Args:
        sheet_idx: Sheet index
        table_idx: Table index
        col_idx: Column index
        format_config: Dictionary containing format settings:
            - wordWrap: bool (optional) - False to disable word wrap
            - numberFormat: dict (optional) - Number formatting options:
                - type: 'number' | 'currency' | 'percent'
                - decimals: int
                - useThousandsSeparator: bool
                - currencySymbol: str
    """

    def _update_logic(t):
        current_md = t.metadata or {}
        new_md = current_md.copy()

        current_visual = new_md.get("visual", {})
        updated_visual = current_visual.copy()

        # Ensure 'columns' dict exists
        current_columns = updated_visual.get("columns", {})
        updated_columns = current_columns.copy()

        # Update specific column
        col_key = str(col_idx)
        col_data = updated_columns.get(col_key, {}).copy()

        # Update format settings
        if format_config:
            col_data["format"] = format_config
        elif "format" in col_data:
            # Remove format if empty config provided
            del col_data["format"]

        updated_columns[col_key] = col_data
        updated_visual["columns"] = updated_columns
        new_md["visual"] = updated_visual

        return replace(t, metadata=new_md)

    return apply_table_update(sheet_idx, table_idx, _update_logic)
