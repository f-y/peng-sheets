from .context import EditorContext
from .services import document as document_service
from .services import sheet as sheet_service
from .services import table as table_service
from .services import workbook as workbook_service
from .utils_structure import augment_workbook_metadata, extract_structure

__all__ = [
    "EditorContext",
    "add_document",
    "add_document_and_get_full_update",
    "add_sheet",
    "add_table",
    "augment_workbook_metadata",
    "clear_columns",
    "delete_columns",
    "delete_document",
    "delete_document_and_get_full_update",
    "delete_rows",
    "delete_sheet",
    "delete_table",
    "extract_structure",
    "generate_and_get_range",
    "get_document_section_range",
    "get_full_markdown",
    "get_state",
    "get_workbook_range",
    "initialize_workbook",
    "insert_column",
    "insert_row",
    "move_cells",
    "move_columns",
    "move_document_section",
    "move_rows",
    "move_sheet",
    "move_workbook_section",
    "paste_cells",
    "rename_document",
    "rename_sheet",
    "rename_table",
    "sort_rows",
    "update_cell",
    "update_column_align",
    "update_column_filter",
    "update_column_format",
    "update_column_width",
    "update_sheet_metadata",
    "update_table_metadata",
    "update_visual_metadata",
    "update_workbook_tab_order",
    "delete_row",
    "delete_column",
    "clear_column",
]


def update_workbook_tab_order(tab_order):
    ctx = EditorContext.get_instance()
    return workbook_service.update_workbook_tab_order(ctx, tab_order)


def initialize_workbook(md_text, config_json):
    ctx = EditorContext.get_instance()
    return ctx.initialize_workbook(md_text, config_json)


def get_state():
    ctx = EditorContext.get_instance()
    return ctx.get_state()


def add_sheet(
    new_name, column_names=None, after_sheet_index=None, target_tab_order_index=None
):
    ctx = EditorContext.get_instance()
    return sheet_service.add_sheet(
        ctx, new_name, column_names, after_sheet_index, target_tab_order_index
    )


def rename_sheet(sheet_idx, new_name):
    ctx = EditorContext.get_instance()
    return sheet_service.rename_sheet(ctx, sheet_idx, new_name)


def delete_sheet(sheet_idx):
    ctx = EditorContext.get_instance()
    return sheet_service.delete_sheet(ctx, sheet_idx)


def move_sheet(from_index, to_index, target_tab_order_index=None):
    ctx = EditorContext.get_instance()
    return sheet_service.move_sheet(ctx, from_index, to_index, target_tab_order_index)


def update_sheet_metadata(sheet_idx, metadata):
    ctx = EditorContext.get_instance()
    return sheet_service.update_sheet_metadata(ctx, sheet_idx, metadata)


def add_table(sheet_idx, column_names=None, table_name=None):
    ctx = EditorContext.get_instance()
    return table_service.add_table(ctx, sheet_idx, column_names, table_name)


def delete_table(sheet_idx, table_idx):
    ctx = EditorContext.get_instance()
    return table_service.delete_table(ctx, sheet_idx, table_idx)


def rename_table(sheet_idx, table_idx, new_name):
    ctx = EditorContext.get_instance()
    return table_service.rename_table(ctx, sheet_idx, table_idx, new_name)


def update_table_metadata(sheet_idx, table_idx, new_name, new_description):
    ctx = EditorContext.get_instance()
    return table_service.update_table_metadata(
        ctx, sheet_idx, table_idx, new_name, new_description
    )


def update_visual_metadata(sheet_idx, table_idx, metadata):
    ctx = EditorContext.get_instance()
    return table_service.update_visual_metadata(ctx, sheet_idx, table_idx, metadata)


def update_cell(sheet_idx, table_idx, row_idx, col_idx, value):
    ctx = EditorContext.get_instance()
    return table_service.update_cell(ctx, sheet_idx, table_idx, row_idx, col_idx, value)


def insert_row(sheet_idx, table_idx, row_idx):
    ctx = EditorContext.get_instance()
    return table_service.insert_row(ctx, sheet_idx, table_idx, row_idx)


def delete_rows(sheet_idx, table_idx, row_indices):
    ctx = EditorContext.get_instance()
    return table_service.delete_rows(ctx, sheet_idx, table_idx, row_indices)


def delete_row(sheet_idx, table_idx, row_idx):
    """Wrapper for delete_rows to support singular call."""
    return delete_rows(sheet_idx, table_idx, [row_idx])


def move_rows(sheet_idx, table_idx, row_indices, target_index):
    ctx = EditorContext.get_instance()
    return table_service.move_rows(ctx, sheet_idx, table_idx, row_indices, target_index)


def sort_rows(sheet_idx, table_idx, col_idx, ascending):
    ctx = EditorContext.get_instance()
    return table_service.sort_rows(ctx, sheet_idx, table_idx, col_idx, ascending)


def insert_column(sheet_idx, table_idx, col_idx, column_name="New Column"):
    ctx = EditorContext.get_instance()
    return table_service.insert_column(ctx, sheet_idx, table_idx, col_idx, column_name)


def delete_columns(sheet_idx, table_idx, col_indices):
    ctx = EditorContext.get_instance()
    return table_service.delete_columns(ctx, sheet_idx, table_idx, col_indices)


def delete_column(sheet_idx, table_idx, col_idx):
    """Wrapper for delete_columns to support singular call."""
    return delete_columns(sheet_idx, table_idx, [col_idx])


def move_columns(sheet_idx, table_idx, col_indices, target_index):
    ctx = EditorContext.get_instance()
    return table_service.move_columns(
        ctx, sheet_idx, table_idx, col_indices, target_index
    )


def clear_columns(sheet_idx, table_idx, col_indices):
    ctx = EditorContext.get_instance()
    return table_service.clear_columns(ctx, sheet_idx, table_idx, col_indices)


def clear_column(sheet_idx, table_idx, col_idx):
    """Wrapper for clear_columns to support singular call."""
    return clear_columns(sheet_idx, table_idx, [col_idx])


def update_column_width(sheet_idx, table_idx, col_idx, width):
    ctx = EditorContext.get_instance()
    return table_service.update_column_width(ctx, sheet_idx, table_idx, col_idx, width)


def update_column_format(sheet_idx, table_idx, col_idx, fmt):
    ctx = EditorContext.get_instance()
    return table_service.update_column_format(ctx, sheet_idx, table_idx, col_idx, fmt)


def update_column_align(sheet_idx, table_idx, col_idx, align):
    ctx = EditorContext.get_instance()
    return table_service.update_column_align(ctx, sheet_idx, table_idx, col_idx, align)


def paste_cells(
    sheet_idx, table_idx, start_row, start_col, new_data, include_headers=False
):
    ctx = EditorContext.get_instance()
    return table_service.paste_cells(
        ctx, sheet_idx, table_idx, start_row, start_col, new_data, include_headers
    )


def move_cells(sheet_idx, table_idx, src_range, dest_row, dest_col):
    ctx = EditorContext.get_instance()
    return table_service.move_cells(
        ctx, sheet_idx, table_idx, src_range, dest_row, dest_col
    )


def get_document_section_range(section_index):
    ctx = EditorContext.get_instance()
    return document_service.get_document_section_range(ctx, section_index)


def add_document(
    title, after_doc_index=-1, after_workbook=False, insert_after_tab_order_index=-1
):
    ctx = EditorContext.get_instance()
    return document_service.add_document(
        ctx, title, after_doc_index, after_workbook, insert_after_tab_order_index
    )


def add_document_and_get_full_update(
    title, after_doc_index=-1, after_workbook=False, insert_after_tab_order_index=-1
):
    ctx = EditorContext.get_instance()
    return document_service.add_document_and_get_full_update(
        ctx, title, after_doc_index, after_workbook, insert_after_tab_order_index
    )


def rename_document(doc_index, new_title):
    ctx = EditorContext.get_instance()
    return document_service.rename_document(ctx, doc_index, new_title)


def delete_document(doc_index):
    ctx = EditorContext.get_instance()
    return document_service.delete_document(ctx, doc_index)


def delete_document_and_get_full_update(doc_index):
    ctx = EditorContext.get_instance()
    return document_service.delete_document_and_get_full_update(ctx, doc_index)


def move_document_section(
    from_doc_index,
    to_doc_index=None,
    to_after_workbook=False,
    to_before_workbook=False,
    target_tab_order_index=None,
):
    ctx = EditorContext.get_instance()
    return document_service.move_document_section(
        ctx,
        from_doc_index,
        to_doc_index,
        to_after_workbook,
        to_before_workbook,
        target_tab_order_index,
    )


def move_workbook_section(
    to_doc_index=None,
    to_after_doc=False,
    to_before_doc=False,
    target_tab_order_index=None,
):
    ctx = EditorContext.get_instance()
    return document_service.move_workbook_section(
        ctx, to_doc_index, to_after_doc, to_before_doc, target_tab_order_index
    )


def update_column_filter(sheet_idx, table_idx, col_idx, hidden_values):
    ctx = EditorContext.get_instance()
    return table_service.update_column_filter(
        ctx, sheet_idx, table_idx, col_idx, hidden_values
    )


def get_full_markdown():
    ctx = EditorContext.get_instance()
    return ctx.md_text


def generate_and_get_range():
    ctx = EditorContext.get_instance()
    return workbook_service.generate_and_get_range(ctx)


def get_workbook_range(md_text, root_marker, sheet_header_level):
    return workbook_service.get_workbook_range(md_text, root_marker, sheet_header_level)
