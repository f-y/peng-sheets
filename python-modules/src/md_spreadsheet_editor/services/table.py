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

    return apply_sheet_update(context, sheet_idx, sheet_update_logic)
