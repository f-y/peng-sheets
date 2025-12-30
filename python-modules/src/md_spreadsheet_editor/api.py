from .context import EditorContext
from .services import sheet as sheet_service
from .services import table as table_service


def initialize_workbook(md_text, config_json):
    ctx = EditorContext()
    return ctx.initialize_workbook(md_text, config_json)


def get_state():
    ctx = EditorContext()
    return ctx.get_state()


def add_sheet(
    new_name, column_names=None, after_sheet_index=None, target_tab_order_index=None
):
    ctx = EditorContext()
    return sheet_service.add_sheet(
        ctx, new_name, column_names, after_sheet_index, target_tab_order_index
    )


def rename_sheet(sheet_idx, new_name):
    ctx = EditorContext()
    return sheet_service.rename_sheet(ctx, sheet_idx, new_name)


def delete_sheet(sheet_idx):
    ctx = EditorContext()
    return sheet_service.delete_sheet(ctx, sheet_idx)


def move_sheet(from_index, to_index, target_tab_order_index=None):
    ctx = EditorContext()
    return sheet_service.move_sheet(ctx, from_index, to_index, target_tab_order_index)


def add_table(sheet_idx, column_names=None):
    ctx = EditorContext()
    return table_service.add_table(ctx, sheet_idx, column_names)


def delete_table(sheet_idx, table_idx):
    ctx = EditorContext()
    return table_service.delete_table(ctx, sheet_idx, table_idx)


def rename_table(sheet_idx, table_idx, new_name):
    ctx = EditorContext()
    return table_service.rename_table(ctx, sheet_idx, table_idx, new_name)


from .services import document as document_service


def get_document_section_range(section_index):
    ctx = EditorContext()
    return document_service.get_document_section_range(ctx, section_index)


def add_document(
    title, after_doc_index=-1, after_workbook=False, insert_after_tab_order_index=-1
):
    ctx = EditorContext()
    return document_service.add_document(
        ctx, title, after_doc_index, after_workbook, insert_after_tab_order_index
    )


def add_document_and_get_full_update(
    title, after_doc_index=-1, after_workbook=False, insert_after_tab_order_index=-1
):
    ctx = EditorContext()
    return document_service.add_document_and_get_full_update(
        ctx, title, after_doc_index, after_workbook, insert_after_tab_order_index
    )


def rename_document(doc_index, new_title):
    ctx = EditorContext()
    return document_service.rename_document(ctx, doc_index, new_title)


def delete_document(doc_index):
    ctx = EditorContext()
    return document_service.delete_document(ctx, doc_index)


def delete_document_and_get_full_update(doc_index):
    ctx = EditorContext()
    return document_service.delete_document_and_get_full_update(ctx, doc_index)


def move_document_section(
    from_doc_index,
    to_doc_index=None,
    to_after_workbook=False,
    to_before_workbook=False,
    target_tab_order_index=None,
):
    ctx = EditorContext()
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
    ctx = EditorContext()
    return document_service.move_workbook_section(
        ctx, to_doc_index, to_after_doc, to_before_doc, target_tab_order_index
    )
