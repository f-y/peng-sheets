import json
from dataclasses import replace

from md_spreadsheet_parser import (
    MultiTableParsingSchema,
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

    if root_marker:
        for i, line in enumerate(lines):
            if line.strip() == root_marker:
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

    for i in range(start_line + 1, len(lines)):
        line = lines[i].strip()
        if line.startswith("#"):
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
        new_md = generate_workbook_markdown(workbook, schema)

    # Determine replacement range
    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")
    sheet_header_level = config_dict.get("sheetHeaderLevel", 2)

    start_line, end_line = get_workbook_range(md_text, root_marker, sheet_header_level)
    lines = md_text.split("\n")

    end_col = 0

    # EOF Handling: If logic points to line AFTER last line (len(lines)),
    # we must clamp to the actual end of the document (last line, last char).
    if end_line >= len(lines):
        end_line = len(lines) - 1
        end_col = len(lines[end_line])

        # Ensure new content prepends newline if appending to a non-empty file without trailing newline
        if start_line > end_line:  # Edge case: appending to empty or after end
            pass  # Logic below handles start_line checks

    # Logic for appending (start_line check logic preserved/moved)
    # Original: if start_line == len(lines): ...

    # Refined Logic:
    # If we are strictly appending (start_line was calculated as len(lines) in get_workbook_range)
    # Then end_line is also len(lines).
    # We need to target (len-1, len) ?

    if start_line >= len(lines):
        # It's an append.
        # Target the very end.
        start_line = len(lines) - 1
        if start_line < 0:
            start_line = 0  # Empty file

        # Wait, get_workbook_range set start_line = len(lines).
        # If file is "A". lines=["A"]. start_line=1.
        # We want to append "\nNew".
        # We should Insert at (0, 1)? Or (1, 0) [Invalid]?
        # Document end is (0, 1).

        if len(lines) > 0:
            start_line = len(lines) - 1
            # Adjust start_Col?
            # If we send startCol=0, we replace the last line? No.
            # We want to append.
            # Ideally we use VS Code's "Insert" semantics, but here we prefer Range Replacement.
            # If we replace (LastLine, LastChar) -> (LastLine, LastChar) with "\nNewTable".
            # That works.

            # Re-read get_workbook_range.
            # If not found, start_line = len(lines).

            pass

    return {
        "startLine": start_line,
        "endLine": end_line,
        "endCol": end_col,
        "content": new_md + "\n\n",
    }


def add_sheet(new_name):
    # Handle add_sheet separately as it handles None workbook
    global workbook
    if workbook is None:
        workbook = Workbook(sheets=[])
    try:
        workbook = workbook.add_sheet(new_name)
        return generate_and_get_range()
    except Exception as e:
        return {"error": str(e)}


def add_table(sheet_idx):
    def sheet_transform(sheet):
        new_tables = list(sheet.tables)
        new_table = Table(
            name=f"New Table {len(new_tables) + 1}",
            description="",
            headers=["A", "B", "C"],
            rows=[["", "", ""]],
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


def move_sheet(from_index, to_index):
    def wb_transform(wb):
        new_sheets = list(wb.sheets)
        if from_index < 0 or from_index >= len(new_sheets):
            raise IndexError("Invalid source index")

        sheet = new_sheets.pop(from_index)

        # Clamp to_index to valid insertion points [0, len(new_sheets)]
        # len(new_sheets) here is N-1 (after pop)
        insert_idx = max(0, min(to_index, len(new_sheets)))

        new_sheets.insert(insert_idx, sheet)
        return replace(wb, sheets=new_sheets)

    return apply_workbook_update(wb_transform)


def update_sheet_metadata(sheet_idx, metadata):
    return apply_sheet_update(sheet_idx, lambda s: replace(s, metadata=metadata))


def update_table_metadata(sheet_idx, table_idx, new_name, new_desc):
    return apply_table_update(
        sheet_idx, table_idx, lambda t: replace(t, name=new_name, description=new_desc)
    )


def update_cell(sheet_idx, table_idx, row_idx, col_idx, value):
    return apply_table_update(
        sheet_idx, table_idx, lambda t: t.update_cell(row_idx, col_idx, value)
    )


def delete_row(sheet_idx, table_idx, row_idx):
    return apply_table_update(sheet_idx, table_idx, lambda t: t.delete_row(row_idx))


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


def paste_cells(sheet_idx, table_idx, start_row, start_col, new_data):
    def _paste_logic(t):
        current_rows = [list(r) for r in t.rows]
        rows_to_paste = len(new_data)
        if rows_to_paste == 0:
            return t

        # Max columns in pasted data
        cols_to_paste = 0
        for row in new_data:
            cols_to_paste = max(cols_to_paste, len(row))

        # 1. Expand Rows
        needed_rows = start_row + rows_to_paste
        # Determine width for new empty rows
        base_width = len(t.headers) if t.headers else 0
        if current_rows:
            base_width = max(base_width, len(current_rows[0]))

        while len(current_rows) < needed_rows:
            current_rows.append([""] * base_width)

        # 2. Update Data & Expand Columns if needed
        max_cols_needed = start_col + cols_to_paste

        for r_offset, row_data in enumerate(new_data):
            target_r = start_row + r_offset

            # Expand this row's columns
            while len(current_rows[target_r]) < max_cols_needed:
                current_rows[target_r].append("")

            for c_offset, val in enumerate(row_data):
                target_c = start_col + c_offset
                current_rows[target_r][target_c] = val

        # 3. Homogenize row lengths and headers
        global_max_width = 0
        for r in current_rows:
            global_max_width = max(global_max_width, len(r))

        if t.headers:
            global_max_width = max(global_max_width, len(t.headers))

        # Pad all rows
        for r in current_rows:
            while len(r) < global_max_width:
                r.append("")

        # Pad headers
        new_headers = list(t.headers) if t.headers else []
        if new_headers:
            while len(new_headers) < global_max_width:
                new_headers.append(f"Col {len(new_headers) + 1}")

        return replace(t, rows=current_rows, headers=new_headers)

    return apply_table_update(sheet_idx, table_idx, _paste_logic)


def augment_workbook_metadata(workbook_dict, md_text, root_marker, sheet_header_level):
    lines = md_text.split("\n")

    # Find root marker first to replicate parse_workbook skip logic
    start_index = 0
    if root_marker:
        for i, line in enumerate(lines):
            if line.strip() == root_marker:
                start_index = i + 1
                break

    header_prefix = "#" * sheet_header_level + " "

    current_sheet_idx = 0

    # Simple scan for sheet headers
    # We assume parse_workbook found them in order.
    for idx, line in enumerate(lines[start_index:], start=start_index):
        stripped = line.strip()

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

    for line in lines:
        if line.startswith("# ") and not line.startswith("##"):
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
