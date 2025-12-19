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
                current_rows[target_r][target_c] = val

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

    for i, line in enumerate(lines):
        if line.startswith("# ") and not line.startswith("##"):
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
        col_data["align"] = alignment
        updated_columns[col_key] = col_data

        updated_visual["columns"] = updated_columns
        new_md["visual"] = updated_visual

        return replace(t, metadata=new_md)

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
