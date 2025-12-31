import json
from dataclasses import replace

from md_spreadsheet_parser import generate_workbook_markdown


def update_workbook_tab_order(context, tab_order):
    """
    Update the tab display order in workbook metadata.

    Args:
        context: EditorContext
        tab_order: List of dicts describing tab order

    Returns:
        dict with 'content', 'startLine', 'endLine' or 'error' if failed
    """

    def wb_transform(wb):
        current_metadata = dict(wb.metadata) if wb.metadata else {}
        current_metadata["tab_order"] = tab_order
        return replace(wb, metadata=current_metadata)

    return update_workbook(context, wb_transform)


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


def update_workbook(context, transform_func):
    if context.workbook is None:
        return {"error": "No workbook"}
    try:
        new_workbook = transform_func(context.workbook)
        context.update_workbook(new_workbook)
        return generate_and_get_range(context)
    except Exception as e:
        return {"error": str(e)}


def generate_and_get_range(context):
    workbook = context.workbook
    schema = context.schema
    md_text = context.md_text
    config = context.config

    # Generate Markdown (Full Workbook)
    if not workbook or not workbook.sheets:
        new_md = ""
    else:
        if schema is None:
            new_md = ""
        else:
            new_md = generate_workbook_markdown(workbook, schema)

    # Determine replacement range
    config_dict = json.loads(config) if config else {}
    root_marker = config_dict.get("rootMarker", "# Tables")
    sheet_header_level = config_dict.get("sheetHeaderLevel", 2)

    start_line, end_line = get_workbook_range(md_text, root_marker, sheet_header_level)
    lines = md_text.split("\n")
    # ... (existing calculation) ...
    end_col = 0
    if end_line >= len(lines):
        end_line = len(lines) - 1
        end_col = len(lines[end_line]) if end_line >= 0 else 0
    else:
        if end_line > 0:
            end_line = end_line - 1
            end_col = len(lines[end_line])

    content = new_md + "\n"

    # Ensure empty line before appended content if file is not empty
    # We want 2 newlines separation between previous content and new content.
    if start_line >= len(lines) and md_text:
        trailing_newlines = 0
        for char in reversed(md_text):
            if char == "\n":
                trailing_newlines += 1
            else:
                break

        needed = max(0, 2 - trailing_newlines)
        content = ("\n" * needed) + content

    return {
        "startLine": start_line,
        "endLine": end_line,
        "endCol": end_col,
        "content": content,
    }


def reorder_tab_metadata(wb, item_type, from_idx, to_idx, target_tab_order_index):
    """
    Updates tab_order metadata after a physical move of a sheet or document.
    """
    if not wb or not wb.metadata:
        return wb

    metadata = dict(wb.metadata)
    tab_order = list(metadata.get("tab_order", []))

    if not tab_order:
        return wb

    indices_in_tab_order = [
        item["index"] for item in tab_order if item["type"] == item_type
    ]
    if not indices_in_tab_order:
        return wb

    max_index = max(indices_in_tab_order)
    max_index = max(max_index, from_idx)
    clamped_to_idx = min(to_idx, max_index)

    dummy_list = list(range(max_index + 1))

    if from_idx < len(dummy_list):
        moved_item = dummy_list.pop(from_idx)
        insert_idx = max(0, min(clamped_to_idx, len(dummy_list)))
        dummy_list.insert(insert_idx, moved_item)

    new_index_map = {old: new for new, old in enumerate(dummy_list)}

    moved_tab_order_item = None

    for item in tab_order:
        if item["type"] == item_type:
            old_idx = item["index"]
            if old_idx in new_index_map:
                item["index"] = new_index_map[old_idx]

            if old_idx == from_idx:
                moved_tab_order_item = item

    if moved_tab_order_item and target_tab_order_index is not None:
        try:
            curr_pos = tab_order.index(moved_tab_order_item)
            tab_order.pop(curr_pos)

            # Adjust target index if we removed an item that was before the target
            if curr_pos < target_tab_order_index:
                target_tab_order_index -= 1

            safe_target = max(0, min(target_tab_order_index, len(tab_order)))
            tab_order.insert(safe_target, moved_tab_order_item)
        except ValueError:
            pass

    metadata["tab_order"] = tab_order
    return replace(wb, metadata=metadata)


def apply_sheet_update(context, sheet_idx, transform_func):
    def wb_transform(wb):
        new_sheets = list(wb.sheets)
        if sheet_idx < 0 or sheet_idx >= len(new_sheets):
            raise IndexError("Invalid sheet index")

        target_sheet = new_sheets[sheet_idx]
        new_sheet = transform_func(target_sheet)
        new_sheets[sheet_idx] = new_sheet
        return replace(wb, sheets=new_sheets)

    return update_workbook(context, wb_transform)
