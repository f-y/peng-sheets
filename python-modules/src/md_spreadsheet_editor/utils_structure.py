import json


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
