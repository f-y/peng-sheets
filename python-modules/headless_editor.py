import json
from dataclasses import replace

from md_spreadsheet_parser import (
    MultiTableParsingSchema,
    Sheet,
    Workbook,
    generate_workbook_markdown,
    parse_workbook,
)
from md_spreadsheet_parser.models import Table

# Global State (managed by the runtime)
workbook = None
schema = None
md_text = ""
config = ""


def apply_workbook_update(transform_func):
    global workbook
    if workbook is None:
        return {"error": "No workbook"}
    try:
        workbook = transform_func(workbook)
        return generate_and_get_range()
    except Exception as e:
        return {"error": str(e)}


def apply_sheet_update(sheet_idx, transform_func):
    def wb_transform(wb):
        new_sheets = list(wb.sheets)
        if sheet_idx < 0 or sheet_idx >= len(new_sheets):
            raise IndexError("Invalid sheet index")

        target_sheet = new_sheets[sheet_idx]
        new_sheet = transform_func(target_sheet)
        new_sheets[sheet_idx] = new_sheet
        return replace(wb, sheets=new_sheets)

    return apply_workbook_update(wb_transform)


def apply_table_update(sheet_idx, table_idx, transform_func):
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
    lines = md_text.split("\n")
    start_line = 0
    found = False

    in_code_block = False
    if root_marker:
        for i, line in enumerate(lines):
            if line.strip().startswith("```"):
                in_code_block = not in_code_block
            if not in_code_block and line.strip() == root_marker:
                start_line = i
                found = True
                break

        if not found:
            start_line = len(lines)

    end_line = len(lines)

    def get_level(s):
        lvl = 0
        for c in s:
            if c == "#":
                lvl += 1
            else:
                break
        return lvl

    # Start scanning from start_line to keep track of code blocks if needed?
    # Actually, since start_line is a header (or 0/EOF), we can assume in_code_block is False at start_line.
    # But if start_line is 0 and we didn't check root_marker (found=False), line 0 might be start of code block.
    # However, if found=False, start_line=len(lines), so loop doesn't run.
    # If found=True, start_line is the root marker (a header). So it's not in a code block.
    # So resetting in_code_block = False is safe.

    in_code_block = False
    for i in range(start_line + 1, len(lines)):
        line = lines[i].strip()
        if line.startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block and line.startswith("#"):
            lvl = get_level(line)
            if lvl < sheet_header_level:
                end_line = i
                break

    return start_line, end_line


def generate_and_get_range():
    global workbook, schema, md_text, config

    # Generate Markdown (Full Workbook)
    # Fix: If no sheets, remove the section entirely (including root marker)
    if not workbook or not workbook.sheets:
        new_md = ""
    else:
        assert schema is not None  # Schema should be set after initialize()
        new_md = generate_workbook_markdown(workbook, schema)

    # Determine replacement range
    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")
    sheet_header_level = config_dict.get("sheetHeaderLevel", 2)

    start_line, end_line = get_workbook_range(md_text, root_marker, sheet_header_level)
    lines = md_text.split("\n")

    end_col = 0

    # Case 1: end_line points beyond the file (workbook is at EOF)
    # We need to replace up to and including the last character
    if end_line >= len(lines):
        end_line = len(lines) - 1
        end_col = len(lines[end_line])
    # Case 2: end_line points to a line within the file (workbook is followed by other content)
    # end_line is the line of the NEXT section (e.g., "# Appendix")
    # We should NOT include that line in our replacement
    # So we set end_line to the previous line and end_col to its length
    else:
        # Move back to include the blank line before the next section if present
        # The range should end at line end_line - 1, at its last character
        if end_line > 0:
            end_line = end_line - 1
            end_col = len(lines[end_line])

    # Handle case where start_line is beyond the file (appending to end)
    if start_line >= len(lines):
        start_line = len(lines) - 1
        if start_line < 0:
            start_line = 0

    return {
        "startLine": start_line,
        "endLine": end_line,
        "endCol": end_col,
        "content": new_md + "\n\n",
    }


def add_sheet(new_name, column_names=None):
    # Handle add_sheet separately as it handles None workbook
    global workbook
    if workbook is None:
        workbook = Workbook(sheets=[])

    if column_names is None:
        column_names = ["Column 1", "Column 2", "Column 3"]

    try:
        # Create new sheet manually with custom headers
        new_table = Table(
            headers=column_names, rows=[["" for _ in column_names]], metadata={}
        )
        new_sheet = Sheet(name=new_name, tables=[new_table])

        new_sheets = list(workbook.sheets)
        new_sheet_index = len(new_sheets)  # Index of the new sheet
        new_sheets.append(new_sheet)

        # Update tab_order metadata to include the new sheet
        current_metadata = dict(workbook.metadata) if workbook.metadata else {}
        tab_order = list(current_metadata.get("tab_order", []))
        # Add new sheet entry at the end of tab_order
        tab_order.append({"type": "sheet", "index": new_sheet_index})
        current_metadata["tab_order"] = tab_order

        workbook = replace(workbook, sheets=new_sheets, metadata=current_metadata)
        return generate_and_get_range()
    except Exception as e:
        return {"error": str(e)}


def add_table(sheet_idx, column_names=None):
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

    return apply_sheet_update(sheet_idx, sheet_transform)


def delete_table(sheet_idx, table_idx):
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        if table_idx < 0 or table_idx >= len(new_tables):
            raise IndexError("Invalid table index")

        del new_tables[table_idx]
        return replace(sheet, tables=new_tables)

    return apply_sheet_update(sheet_idx, sheet_transform)


def delete_sheet(sheet_idx):
    return apply_workbook_update(lambda wb: wb.delete_sheet(sheet_idx))


def rename_sheet(sheet_idx, new_name):
    return apply_sheet_update(sheet_idx, lambda s: replace(s, name=new_name))


def move_sheet(from_index, to_index, target_tab_order_index=None):
    def wb_transform(wb):
        new_sheets = list(wb.sheets)
        if from_index < 0 or from_index >= len(new_sheets):
            raise IndexError("Invalid source index")

        sheet = new_sheets.pop(from_index)

        # Clamp to_index to valid insertion points [0, len(new_sheets)]
        # len(new_sheets) here is N-1 (after pop)
        insert_idx = max(0, min(to_index, len(new_sheets)))

        new_sheets.insert(insert_idx, sheet)
        wb = replace(wb, sheets=new_sheets)

        if target_tab_order_index is not None:
            wb = _reorder_tab_metadata(
                wb, "sheet", from_index, insert_idx, target_tab_order_index
            )

        return wb

    return apply_workbook_update(wb_transform)


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


def delete_column(sheet_idx, table_idx, col_idx):
    return apply_table_update(sheet_idx, table_idx, lambda t: t.delete_column(col_idx))


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


def insert_row(sheet_idx, table_idx, row_idx):
    return apply_table_update(sheet_idx, table_idx, lambda t: t.insert_row(row_idx))


def insert_column(sheet_idx, table_idx, col_idx):
    return apply_table_update(sheet_idx, table_idx, lambda t: t.insert_column(col_idx))


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
            while len(r) < global_max_width:
                r.append("")

        # Pad headers
        if new_headers:
            while len(new_headers) < global_max_width:
                new_headers.append(f"Col {len(new_headers) + 1}")

        # If rows_to_paste was 0 but we updated headers, still return updated table
        return replace(t, rows=current_rows, headers=new_headers)

    return apply_table_update(sheet_idx, table_idx, _paste_logic)


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
    global md_text, config

    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")

    lines = md_text.split("\n")
    sections = []
    current_section = None
    current_start = None

    in_code_block = False

    for i, line in enumerate(lines):
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block and line.startswith("# ") and not line.startswith("##"):
            # End previous section
            if current_section is not None:
                sections.append(
                    {
                        "start": current_start,
                        "end": i - 1,
                        "type": current_section["type"],
                    }
                )

            stripped = line.strip()
            if stripped == root_marker:
                current_section = {"type": "workbook"}
            else:
                current_section = {"type": "document"}
            current_start = i

    # Add final section
    if current_section is not None:
        sections.append(
            {
                "start": current_start,
                "end": len(lines) - 1,
                "type": current_section["type"],
            }
        )

    # Find document sections only
    doc_sections = [s for s in sections if s["type"] == "document"]

    if section_index < 0 or section_index >= len(doc_sections):
        return {"error": f"Invalid section index: {section_index}"}

    target = doc_sections[section_index]
    # Return end_col as length of the end line to cover the full line
    end_line = target["end"]
    end_col = len(lines[end_line]) if end_line < len(lines) else 0
    return {"start_line": target["start"], "end_line": end_line, "end_col": end_col}


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
    global md_text, config, workbook

    if not title:
        title = "New Document"

    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")

    lines = md_text.split("\n")
    sections = []
    current_start = None
    current_type = None

    in_code_block = False

    for i, line in enumerate(lines):
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block and line.startswith("# ") and not line.startswith("##"):
            if current_start is not None:
                sections.append(
                    {"start": current_start, "end": i - 1, "type": current_type}
                )

            stripped = line.strip()
            if stripped == root_marker:
                current_type = "workbook"
            else:
                current_type = "document"
            current_start = i

    if current_start is not None:
        sections.append(
            {"start": current_start, "end": len(lines) - 1, "type": current_type}
        )

    # Determine insertion point
    insert_line = 0
    doc_count = 0

    if after_workbook:
        # Find workbook and insert after it
        for s in sections:
            if s["type"] == "workbook":
                insert_line = s["end"] + 1
                break
    elif after_doc_index >= 0:
        # Find the specific document and insert after it
        for s in sections:
            if s["type"] == "document":
                if doc_count == after_doc_index:
                    insert_line = s["end"] + 1
                    break
                doc_count += 1
        else:
            # If index not found, insert at end of file
            insert_line = len(lines)
    else:
        # Insert at beginning (before first section or at line 0)
        insert_line = 0

    # Create new document content (with blank line separator)
    new_doc_content = f"# {title}\n\n"

    # Update md_text to include the new document
    # This is critical for subsequent calls like generate_and_get_range() to work correctly
    # Split new_doc_content into lines and insert them
    new_lines = new_doc_content.split("\n")
    # Remove trailing empty string from split (if content ends with \n)
    if new_lines and new_lines[-1] == "":
        new_lines = new_lines[:-1]
    for i, line in enumerate(new_lines):
        lines.insert(insert_line + i, line)
    md_text = "\n".join(lines)

    # Calculate the edit range
    # We're inserting new content, so startLine = endLine = insert_line
    # The frontend will insert the content at that position

    # Update tab_order in workbook metadata
    if workbook is not None:
        current_metadata = dict(workbook.metadata) if workbook.metadata else {}
        tab_order = list(current_metadata.get("tab_order", []))

        # Calculate the actual docIndex for the new document
        # When inserting after doc N, the new doc will be at position N+1 in file order
        if after_doc_index >= 0:
            new_doc_index = after_doc_index + 1
        else:
            # Inserting at beginning - new doc will be docIndex 0
            new_doc_index = 0

        # Increment indices of all documents >= new_doc_index in tab_order
        for i, entry in enumerate(tab_order):
            if (
                entry.get("type") == "document"
                and entry.get("index", -1) >= new_doc_index
            ):
                tab_order[i] = {"type": "document", "index": entry["index"] + 1}

        # Create new document entry
        new_doc_entry = {"type": "document", "index": new_doc_index}

        # Insert at specified position or append
        if insert_after_tab_order_index >= 0:
            # Insert after the specified index (clamped to valid range)
            insert_pos = min(insert_after_tab_order_index + 1, len(tab_order))
            tab_order.insert(insert_pos, new_doc_entry)
        else:
            # Append to end (default behavior)
            tab_order.append(new_doc_entry)

        current_metadata["tab_order"] = tab_order
        workbook = replace(workbook, metadata=current_metadata)

    return {
        "content": new_doc_content,
        "startLine": insert_line,
        "endLine": insert_line,
        "file_changed": True,
    }


def move_document_section(
    from_doc_index,
    to_doc_index=None,
    to_after_workbook=False,
    to_before_workbook=False,
    target_tab_order_index=None,
):
    """
    Move a document section to a new position.


    Document-to-Document moves always require file changes because
    we're physically reordering sections in the Markdown.

    Args:
        from_doc_index: Index of document to move
        to_doc_index: Target document index position (optional)
        to_after_workbook: Move to immediately after workbook
        to_before_workbook: Move to immediately before workbook
        target_tab_order_index: Optional target index in tab_order list for metadata update

    Returns:
        dict with 'content', 'startLine', 'endLine', 'file_changed' or 'error'
    """
    global md_text, config, workbook

    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")

    lines = md_text.split("\n")
    sections = []
    current_start = None
    current_type = None

    in_code_block = False

    for i, line in enumerate(lines):
        if line.strip().startswith("```"):
            in_code_block = not in_code_block

        if not in_code_block and line.startswith("# ") and not line.startswith("##"):
            if current_start is not None:
                sections.append(
                    {"start": current_start, "end": i - 1, "type": current_type}
                )

            stripped = line.strip()
            if stripped == root_marker:
                current_type = "workbook"
            else:
                current_type = "document"
            current_start = i

    if current_start is not None:
        sections.append(
            {"start": current_start, "end": len(lines) - 1, "type": current_type}
        )

    # Get document sections
    doc_sections = [(i, s) for i, s in enumerate(sections) if s["type"] == "document"]

    if from_doc_index < 0 or from_doc_index >= len(doc_sections):
        return {"error": f"Invalid source document index: {from_doc_index}"}

    # Check for no-op (same position)
    if (
        to_doc_index is not None
        and from_doc_index == to_doc_index
        and target_tab_order_index is None
    ):
        return {"file_changed": False, "metadata_changed": False}

    # Get source document
    source_section_idx, source_section = doc_sections[from_doc_index]
    source_start = source_section["start"]
    source_end = source_section["end"]

    # Extract source content
    source_lines = lines[source_start : source_end + 1]

    # Determin target position physically
    target_line = 0
    calculated_to_doc_index = to_doc_index

    if to_after_workbook:
        for s in sections:
            if s["type"] == "workbook":
                target_line = s["end"] + 1
                break
        # Moving to after workbook means becoming the first document *after* workbook?
        # Or just adjusting position?
        # We need actual numeric index for metadata update.
        # This logic is a bit complex for metadata mapping without explicit to_doc_index.
        # But if to_after_workbook is used, it usually means appending or moving to specific spot.
    elif to_before_workbook:
        for s in sections:
            if s["type"] == "workbook":
                target_line = s["start"]
                break
    elif to_doc_index is not None:
        if to_doc_index >= len(doc_sections):
            # Move to end
            target_line = len(lines)
        else:
            _, target_section = doc_sections[to_doc_index]
            target_line = target_section["start"]
    else:
        return {"error": "No target position specified"}

    # If to_doc_index is None (using flags), we need to infer it for metadata update
    # But for now let's assume UI passes to_doc_index correctly when reusing this for reorder.

    # Build new content by removing source and inserting at target
    new_lines = []
    inserted = False

    for i, line in enumerate(lines):
        # Skip source lines
        if source_start <= i <= source_end:
            continue

        # Insert at target position (adjusted for removed lines)
        adjusted_target = (
            target_line
            if target_line <= source_start
            else target_line - (source_end - source_start + 1)
        )
        current_pos = len(new_lines)

        if not inserted and current_pos >= adjusted_target:
            new_lines.extend(source_lines)
            inserted = True

        new_lines.append(line)

    # If not inserted yet (target was at end)
    if not inserted:
        new_lines.extend(source_lines)

    new_md = "\n".join(new_lines)

    # Update tab_order in workbook metadata
    updated_workbook = workbook
    if workbook is not None and target_tab_order_index is not None:
        # Determine actual to_doc_index for metadata logic
        # If we moved physically, we simply need to Apply the same index shift logic
        # move_sheet logic: pop from_index, insert at to_index
        # We need effective to_index.
        effective_to_index = to_doc_index if to_doc_index is not None else 0  # Fallback

        updated_workbook = _reorder_tab_metadata(
            workbook,
            "document",
            from_doc_index,
            effective_to_index,
            target_tab_order_index,
        )
    elif workbook is not None:
        # Just update indices without changing tab_order list order?
        # Or if no target_tab_order_index is strictly provided but to_doc_index IS provided (reorder case)
        # For simplicity, Require target_tab_order_index (passed from UI) to trigger metadata fix.
        pass

    if updated_workbook != workbook:
        workbook = updated_workbook

    # Return the full new content for the file
    return {
        "content": new_md,
        "startLine": 0,
        "endLine": len(lines) - 1,
        "file_changed": True,
        "metadata_changed": True,
    }


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

    clamped_from = from_idx
    # We assume valid range from caller

    # Effective insertion index behavior
    # If moving 0 to 2 (list size 3: A,B,C -> B,C,A)
    # A becomes 2. B(1)->0. C(2)->1.

    # Map old_index -> new_index
    index_map = {}

    # Count total items of this type
    count = 0

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
    # Safety: ensure we cover at least up to from/to
    max_index = max(max_index, from_idx, to_idx)

    # Create dummy list representing physical positions
    # item at index i holds the original index 'i'
    dummy_list = list(range(max_index + 1))

    if from_idx < len(dummy_list):
        moved_item = dummy_list.pop(from_idx)
        # clamp insert
        insert_idx = max(0, min(to_idx, len(dummy_list)))
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
    global workbook, schema, md_text, config
    md_text = md_text_input
    config = config_json
    config_dict = json.loads(config)

    schema = MultiTableParsingSchema(
        root_marker=config_dict.get("rootMarker", "# Tables"),
        sheet_header_level=config_dict.get("sheetHeaderLevel", 2),
        table_header_level=config_dict.get("tableHeaderLevel", 3),
        capture_description=config_dict.get("captureDescription", True),
        column_separator=config_dict.get("columnSeparator", "|"),
        header_separator_char=config_dict.get("headerSeparatorChar", "-"),
        require_outer_pipes=config_dict.get("requireOuterPipes", True),
        strip_whitespace=config_dict.get("stripWhitespace", True),
    )

    workbook = parse_workbook(md_text, schema)


def get_state():
    global workbook, md_text, config
    if workbook is None:
        return json.dumps({"error": "No workbook"})

    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")
    sheet_header_level = config_dict.get("sheetHeaderLevel", 2)

    workbook_json = workbook.json
    augment_workbook_metadata(workbook_json, md_text, root_marker, sheet_header_level)

    structure_json = extract_structure(md_text, root_marker)

    return json.dumps(
        {"workbook": workbook_json, "structure": json.loads(structure_json)}
    )


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
