from dataclasses import replace

from md_spreadsheet_parser import Sheet, Table, Workbook

from .workbook import (
    apply_sheet_update,
    generate_and_get_range,
    reorder_tab_metadata,
    update_workbook,
)


def add_sheet(
    context,
    new_name,
    column_names=None,
    after_sheet_index=None,
    target_tab_order_index=None,
):
    # Handle add_sheet separately as it handles None workbook
    # Ideally context.workbook should be initialized, but keeping legacy behavior logic

    if context.workbook is None:
        # If no workbook exists, we can't really "update" in a standard way using update_workbook wrapper easily
        # unless we initialize it.
        # But we can assume context.workbook might be None.
        workbook = Workbook(sheets=[])
    else:
        workbook = context.workbook

    if not new_name:
        # Generate default name if empty
        existing_names = [s.name for s in workbook.sheets]
        i = 1
        while f"Sheet {i}" in existing_names:
            i += 1
        new_name = f"Sheet {i}"

    if column_names is None:
        column_names = ["Column 1", "Column 2", "Column 3"]

    try:
        # Create new sheet manually with custom headers
        new_table = Table(
            headers=column_names, rows=[["" for _ in column_names]], metadata={}
        )
        new_sheet = Sheet(name=new_name, tables=[new_table])

        new_sheets = list(workbook.sheets)

        # Determine insertion position
        if after_sheet_index is not None and 0 <= after_sheet_index <= len(new_sheets):
            # Insert at specified position
            new_sheet_index = after_sheet_index
            new_sheets.insert(new_sheet_index, new_sheet)

            # Renumber sheet indices in metadata for sheets after insertion point
            current_metadata = dict(workbook.metadata) if workbook.metadata else {}
            tab_order = list(current_metadata.get("tab_order", []))

            # Update indices of sheets that come after the insertion point
            for item in tab_order:
                if item["type"] == "sheet" and item["index"] >= new_sheet_index:
                    item["index"] = item["index"] + 1

            # Insert new sheet entry at specified tab_order position
            if target_tab_order_index is not None:
                tab_order.insert(
                    target_tab_order_index, {"type": "sheet", "index": new_sheet_index}
                )
            else:
                tab_order.append({"type": "sheet", "index": new_sheet_index})

            current_metadata["tab_order"] = tab_order
        else:
            # Append at end (default behavior)
            new_sheet_index = len(new_sheets)
            new_sheets.append(new_sheet)

            # Update tab_order metadata to include the new sheet
            current_metadata = dict(workbook.metadata) if workbook.metadata else {}
            tab_order = list(current_metadata.get("tab_order", []))

            # If tab_order is empty, initialize with all existing sheets first
            if not tab_order and new_sheet_index > 0:
                for i in range(new_sheet_index):
                    tab_order.append({"type": "sheet", "index": i})

            # Add new sheet entry at specified position or end
            if target_tab_order_index is not None:
                tab_order.insert(
                    target_tab_order_index, {"type": "sheet", "index": new_sheet_index}
                )
            else:
                tab_order.append({"type": "sheet", "index": new_sheet_index})
            current_metadata["tab_order"] = tab_order

        # Cleanup redundant tab_order
        # If tab_order matches the physical order of sheets exactly, we don't need to persist it.
        # This keeps new workbooks clean ("pure addition").
        is_redundant = True
        if len(tab_order) != len(new_sheets):
            is_redundant = False
        else:
            for i, item in enumerate(tab_order):
                if item["type"] != "sheet" or item["index"] != i:
                    is_redundant = False
                    break

        if is_redundant and "tab_order" in current_metadata:
            del current_metadata["tab_order"]

        new_workbook = replace(workbook, sheets=new_sheets, metadata=current_metadata)
        context.update_workbook(new_workbook)
        return generate_and_get_range(context)

    except Exception as e:
        return {"error": str(e)}


def rename_sheet(context, sheet_idx, new_name):
    return apply_sheet_update(context, sheet_idx, lambda s: replace(s, name=new_name))


def update_sheet_metadata(context, sheet_idx, metadata):
    return apply_sheet_update(
        context, sheet_idx, lambda s: replace(s, metadata=metadata)
    )


def delete_sheet(context, sheet_idx):
    return update_workbook(context, lambda wb: wb.delete_sheet(sheet_idx))


def move_sheet(context, from_index, to_index, target_tab_order_index=None):
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
            wb = reorder_tab_metadata(
                wb, "sheet", from_index, insert_idx, target_tab_order_index
            )

        return wb

    return update_workbook(context, wb_transform)
