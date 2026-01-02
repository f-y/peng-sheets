import json
import re
from dataclasses import replace


from .workbook import (
    generate_and_get_range,
    get_workbook_range,
    initialize_tab_order_from_structure,
    reorder_tab_metadata,
)


def get_document_section_range(context, section_index):
    md_text = context.md_text
    config = context.config

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
    context,
    title,
    after_doc_index=-1,
    after_workbook=False,
    insert_after_tab_order_index=-1,
):
    try:
        md_text = context.md_text
        config = context.config
        workbook = context.workbook

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

            if (
                not in_code_block
                and line.startswith("# ")
                and not line.startswith("##")
            ):
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
        if insert_line > 0:
            new_doc_content = f"\n# {title}\n\n"
        else:
            new_doc_content = f"# {title}\n\n"

        new_lines = new_doc_content.split("\n")
        if new_lines and new_lines[-1] == "":
            new_lines = new_lines[:-1]

        # Modify lines locally
        for i, line in enumerate(new_lines):
            lines.insert(insert_line + i, line)
        new_md_text = "\n".join(lines)

        # Update context
        context.update_state(md_text=new_md_text)

        # Update tab_order in workbook metadata
        if workbook is not None:
            current_metadata = dict(workbook.metadata) if workbook.metadata else {}
            tab_order = list(current_metadata.get("tab_order", []))

            if not tab_order:
                # Initialize from structure using ORIGINAL md_text (before new doc added)
                # This ensures we don't include the just-added document in the initial order
                tab_order = initialize_tab_order_from_structure(
                    md_text, config, len(workbook.sheets)
                )

            if after_doc_index >= 0:
                new_doc_index = after_doc_index + 1
            else:
                new_doc_index = 0

            for i, entry in enumerate(tab_order):
                if (
                    entry.get("type") == "document"
                    and entry.get("index", -1) >= new_doc_index
                ):
                    tab_order[i] = {"type": "document", "index": entry["index"] + 1}

            new_doc_entry = {"type": "document", "index": new_doc_index}

            if insert_after_tab_order_index >= 0:
                insert_pos = min(insert_after_tab_order_index + 1, len(tab_order))
                tab_order.insert(insert_pos, new_doc_entry)
            else:
                tab_order.append(new_doc_entry)

            current_metadata["tab_order"] = tab_order
            new_workbook = replace(workbook, metadata=current_metadata)
            context.update_workbook(new_workbook)

        return {
            "content": new_doc_content,
            "startLine": insert_line,
            "endLine": insert_line,
            "file_changed": True,
        }

    except Exception as e:
        return {"error": str(e)}


def rename_document(context, doc_index, new_title):
    try:
        md_text = context.md_text
        config = context.config

        if not md_text:
            return {"error": "No markdown content"}

        lines = md_text.split("\n")
        config_dict = json.loads(config) if config else {}
        root_marker = config_dict.get("rootMarker", "# Tables")
        doc_header_level = config_dict.get("docHeaderLevel", 1)

        current_doc_index = 0
        in_code_block = False
        for i, line in enumerate(lines):
            stripped = line.strip()

            if stripped.startswith("```"):
                in_code_block = not in_code_block
                continue

            if in_code_block:
                continue

            if stripped.startswith("#") and stripped != root_marker:
                level = len(stripped) - len(stripped.lstrip("#"))
                if level == doc_header_level:
                    if current_doc_index == doc_index:
                        old_header_length = len(lines[i])
                        new_header = "#" * doc_header_level + " " + new_title
                        lines[i] = new_header

                        new_md_text = "\n".join(lines)
                        context.update_state(md_text=new_md_text)

                        return {
                            "content": new_header,
                            "startLine": i,
                            "endLine": i,
                            "endCol": old_header_length,
                            "file_changed": True,
                        }
                    current_doc_index += 1

        return {"error": f"Document at index {doc_index} not found"}

    except Exception as e:
        return {"error": str(e)}


def delete_document(context, doc_index):
    try:
        md_text = context.md_text
        config = context.config
        workbook = context.workbook

        if not md_text:
            return {"error": "No markdown content"}

        lines = md_text.split("\n")
        config_dict = json.loads(config) if config else {}
        root_marker = config_dict.get("rootMarker", "# Tables")
        doc_header_level = config_dict.get("docHeaderLevel", 1)

        sections = []
        current_start = None
        current_type = None
        in_code_block = False

        for i, line in enumerate(lines):
            stripped = line.strip()

            if stripped.startswith("```"):
                in_code_block = not in_code_block
                continue

            if in_code_block:
                continue

            if stripped.startswith("#"):
                level = len(stripped) - len(stripped.lstrip("#"))
                if level == doc_header_level:
                    if current_start is not None:
                        sections.append(
                            {"start": current_start, "end": i - 1, "type": current_type}
                        )

                    if stripped == root_marker:
                        current_type = "workbook"
                    else:
                        current_type = "document"
                    current_start = i

        if current_start is not None:
            sections.append(
                {"start": current_start, "end": len(lines) - 1, "type": current_type}
            )

        current_doc_index = 0
        target_section = None
        for s in sections:
            if s["type"] == "document":
                if current_doc_index == doc_index:
                    target_section = s
                    break
                current_doc_index += 1

        if target_section is None:
            return {"error": f"Document at index {doc_index} not found"}

        start_line = target_section["start"]
        end_line = target_section["end"]

        while end_line > start_line and lines[end_line].strip() == "":
            end_line -= 1

        if end_line < len(lines) - 1:
            end_line += 1

        del lines[start_line : end_line + 1]
        new_md_text = "\n".join(lines)
        context.update_state(md_text=new_md_text)

        if workbook and workbook.metadata:
            current_metadata = dict(workbook.metadata)
            tab_order = list(current_metadata.get("tab_order", []))
            updated_tab_order = []
            for entry in tab_order:
                if entry.get("type") == "document":
                    if entry.get("index") == doc_index:
                        continue
                    elif entry.get("index", 0) > doc_index:
                        updated_tab_order.append(
                            {"type": "document", "index": entry["index"] - 1}
                        )
                    else:
                        updated_tab_order.append(entry)
                else:
                    updated_tab_order.append(entry)

            current_metadata["tab_order"] = updated_tab_order
            new_workbook = replace(workbook, metadata=current_metadata)
            context.update_workbook(new_workbook)

        return {
            "content": "",
            "startLine": start_line,
            "endLine": end_line,
            "file_changed": True,
        }

    except Exception as e:
        return {"error": str(e)}


def delete_document_and_get_full_update(context, doc_index):
    # 1. Get current state to know original line count
    original_md = context.md_text
    lines = original_md.split("\n")
    original_line_count = len(lines)

    # 2. Delete the document (updates state)
    delete_result = delete_document(context, doc_index)
    if delete_result.get("error"):
        return delete_result

    # 3. Regenerate workbook content (with updated metadata)
    # The context already has the updated md_text (post-delete) and updated workbook
    wb_update = generate_and_get_range(context)

    # 4. Construct full content
    # We need to take the md_text acting as "current" (post-delete) and apply wb_update?
    # delete_document updated md_text in context.
    current_md = context.md_text
    current_lines = current_md.split("\n")

    if wb_update and not wb_update.get("error"):
        wb_start = wb_update["startLine"]
        wb_end = wb_update["endLine"]
        wb_content = wb_update["content"]
        wb_content_lines = wb_content.rstrip("\n").split("\n")
        if wb_content:
            wb_content_lines.append("")

        current_lines = (
            current_lines[:wb_start] + wb_content_lines + current_lines[wb_end + 1 :]
        )
        current_md = "\n".join(current_lines)
        context.update_state(md_text=current_md)

    # 5. Get full state
    full_state_json = context.get_full_state_dict()
    full_state = json.loads(full_state_json)

    return {
        "content": current_md,
        "startLine": 0,
        "endLine": original_line_count - 1,
        "endCol": 0,
        "workbook": full_state.get("workbook"),
        "structure": full_state.get("structure"),
    }


def add_document_and_get_full_update(
    context,
    title,
    after_doc_index=-1,
    after_workbook=False,
    insert_after_tab_order_index=-1,
):
    # 1. Add the document (updates md_text globally via context)
    add_result = add_document(
        context, title, after_doc_index, after_workbook, insert_after_tab_order_index
    )

    if add_result.get("error"):
        return add_result

    # 2. Get current md_text from context
    current_md = context.md_text
    lines = current_md.split("\n")
    original_line_count = len(lines)

    # 3. Regenerate workbook content
    wb_update = generate_and_get_range(context)

    # 4. Embed the regenerated workbook content into the md_text
    if wb_update and not wb_update.get("error"):
        wb_start = wb_update["startLine"]
        wb_end = wb_update["endLine"]
        wb_content = wb_update["content"]
        wb_content_lines = wb_content.rstrip("\n").split("\n")
        if wb_content:
            wb_content_lines.append("")

        lines = lines[:wb_start] + wb_content_lines + lines[wb_end + 1 :]
        current_md = "\n".join(lines)
        context.update_state(md_text=current_md)

    # 5. Get full state
    full_state_json = context.get_full_state_dict()
    full_state = json.loads(full_state_json)

    return {
        "content": current_md,
        "startLine": 0,
        "endLine": original_line_count - 1,
        "endCol": 0,
        "workbook": full_state.get("workbook"),
        "structure": full_state.get("structure"),
    }


def move_document_section(
    context,
    from_doc_index,
    to_doc_index=None,
    to_after_workbook=False,
    to_before_workbook=False,
    target_tab_order_index=None,
):
    md_text = context.md_text
    config = context.config
    workbook = context.workbook

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

    doc_sections = [(i, s) for i, s in enumerate(sections) if s["type"] == "document"]

    if from_doc_index < 0 or from_doc_index >= len(doc_sections):
        return {"error": f"Invalid source document index: {from_doc_index}"}

    if (
        to_doc_index is not None
        and from_doc_index == to_doc_index
        and target_tab_order_index is None
    ):
        return {"file_changed": False, "metadata_changed": False}

    source_section_idx, source_section = doc_sections[from_doc_index]
    source_start = source_section["start"]
    source_end = source_section["end"]

    source_lines = lines[source_start : source_end + 1]

    target_line = 0

    if to_after_workbook:
        for s in sections:
            if s["type"] == "workbook":
                target_line = s["end"] + 1
                break
    elif to_before_workbook:
        for s in sections:
            if s["type"] == "workbook":
                target_line = s["start"]
                break
    elif to_doc_index is not None:
        if to_doc_index >= len(doc_sections):
            target_line = len(lines)
        else:
            _, target_section = doc_sections[to_doc_index]
            target_line = target_section["start"]
    else:
        return {"error": "No target position specified"}

    new_lines = []
    inserted = False

    for i, line in enumerate(lines):
        if source_start <= i <= source_end:
            continue

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

    if not inserted:
        new_lines.extend(source_lines)

    new_md = "\n".join(new_lines)
    context.update_state(md_text=new_md)

    updated_workbook = workbook
    if workbook is not None and target_tab_order_index is not None:
        if to_doc_index is not None:
            effective_to_index = to_doc_index
        else:
            tab_order = (
                workbook.metadata.get("tab_order", []) if workbook.metadata else []
            )

            docs_before_target = 0
            for i in range(min(target_tab_order_index, len(tab_order))):
                item = tab_order[i]
                if item["type"] == "document" and item["index"] != from_doc_index:
                    docs_before_target += 1
            effective_to_index = docs_before_target

        updated_workbook = reorder_tab_metadata(
            workbook,
            "document",
            from_doc_index,
            effective_to_index,
            target_tab_order_index,
        )

    if updated_workbook != workbook:
        context.update_workbook(updated_workbook)
        workbook = updated_workbook

        if workbook.metadata:
            new_metadata_json = json.dumps(workbook.metadata, ensure_ascii=False)
            new_metadata_comment = (
                f"<!-- md-spreadsheet-workbook-metadata: {new_metadata_json} -->"
            )

            metadata_pattern = r"<!-- md-spreadsheet-workbook-metadata: \{.*?\} -->"
            if re.search(metadata_pattern, new_md):
                new_md = re.sub(metadata_pattern, new_metadata_comment, new_md)
                context.update_state(md_text=new_md)
            else:
                config_dict = json.loads(config) if config else {}
                root_marker = config_dict.get("rootMarker", "# Tables")
                sheet_header_level = config_dict.get("sheetHeaderLevel", 2)

                new_lines_list = new_md.split("\n")
                wb_start, wb_end = get_workbook_range(
                    new_md, root_marker, sheet_header_level
                )

                if wb_end <= len(new_lines_list):
                    insert_idx = min(wb_end, len(new_lines_list))
                    new_lines_list.insert(insert_idx, "")
                    new_lines_list.insert(insert_idx + 1, new_metadata_comment)
                    new_md = "\n".join(new_lines_list)
                    context.update_state(md_text=new_md)

    return {
        "content": new_md,
        "startLine": 0,
        "endLine": len(lines) - 1,
        "file_changed": True,
        "metadata_changed": True,
    }


def move_workbook_section(
    context,
    to_doc_index=None,
    to_after_doc=False,
    to_before_doc=False,
    target_tab_order_index=None,
):
    md_text = context.md_text
    config = context.config

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

    workbook_section = None
    for s in sections:
        if s["type"] == "workbook":
            workbook_section = s
            break

    if workbook_section is None:
        return {"error": "No workbook section found"}

    doc_sections = [(i, s) for i, s in enumerate(sections) if s["type"] == "document"]

    if to_doc_index is None:
        return {"error": "No target document index specified"}

    if to_doc_index < 0 or to_doc_index > len(doc_sections):
        return {"error": f"Invalid target document index: {to_doc_index}"}

    source_start = workbook_section["start"]
    source_end = workbook_section["end"]
    source_lines = lines[source_start : source_end + 1]

    target_line = 0

    if to_doc_index >= len(doc_sections):
        target_line = len(lines)
    else:
        i, target_section = doc_sections[to_doc_index]
        if to_after_doc:
            target_line = target_section["end"] + 1
        else:
            target_line = target_section["start"]

    new_lines = []
    inserted = False

    for i, line in enumerate(lines):
        if source_start <= i <= source_end:
            continue

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

    if not inserted:
        new_lines.extend(source_lines)

    new_md = "\n".join(new_lines)
    context.update_state(md_text=new_md)

    if target_tab_order_index is not None:
        workbook = context.workbook
        if workbook and workbook.metadata:
            metadata = dict(workbook.metadata)
            tab_order = list(metadata.get("tab_order", []))

            # Extract sheet items and remove them from list
            sheet_items = []
            new_tab_order = []

            for item in tab_order:
                if item.get("type") == "sheet":
                    sheet_items.append(item)
                else:
                    new_tab_order.append(item)

            # Insert sheets at target position
            # We must clamp target to new list length
            safe_target = min(target_tab_order_index, len(new_tab_order))

            # Insert
            final_tab_order = (
                new_tab_order[:safe_target] + sheet_items + new_tab_order[safe_target:]
            )

            metadata["tab_order"] = final_tab_order
            updated_workbook = replace(workbook, metadata=metadata)
            context.update_workbook(updated_workbook)

            # Update metadata in markdown text
            new_metadata_json = json.dumps(metadata, ensure_ascii=False)
            new_metadata_comment = (
                f"<!-- md-spreadsheet-workbook-metadata: {new_metadata_json} -->"
            )
            metadata_pattern = r"<!-- md-spreadsheet-workbook-metadata: \{.*?\} -->"
            if re.search(metadata_pattern, new_md):
                new_md = re.sub(metadata_pattern, new_metadata_comment, new_md)
                context.update_state(md_text=new_md)
            else:
                # Should have been inserted by physical move if not present?
                # But standard flow preserves it or we rely on re-generation.
                # If `reorder_tab_metadata` logic existed, it would handle this.
                pass

    return {
        "content": new_md,
        "startLine": 0,
        "endLine": len(lines) - 1,
        "file_changed": True,
        "metadata_changed": True,
    }
