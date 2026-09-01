use std::io::{self, BufRead, Write};
use serde_json::{json, Value};
use crate::db::Database;
use crate::models::Note;

#[derive(Debug, Clone, serde::Serialize)]
pub struct ChecklistItem {
    pub index: usize,
    pub text: String,
    pub checked: bool,
    pub line_number: usize,
}

// ---------------------------------------------------------------------------
// Markdown to TipTap ProseMirror Converter (Rust Engine)
// ---------------------------------------------------------------------------

pub fn parse_inline_formatting(text: &str) -> Vec<Value> {
    if text.is_empty() {
        return vec![];
    }

    #[derive(Clone)]
    struct Token {
        text: String,
        marks: Vec<Value>,
    }

    let mut tokens = vec![Token {
        text: text.to_string(),
        marks: vec![],
    }];

    // Helper to replace matched patterns
    let apply_mark = |tokens: &mut Vec<Token>, regex_pattern: &str, mark_type: &str, mark_attrs: Option<Value>| {
        let Ok(re) = regex::Regex::new(regex_pattern) else { return; };
        let mut i = 0;
        while i < tokens.len() {
            if tokens[i].marks.iter().any(|m| m["type"] == "code") {
                i += 1;
                continue;
            }

            if let Some(captures) = re.captures(&tokens[i].text) {
                if let Some(m) = captures.get(0) {
                    let start = m.start();
                    let end = m.end();
                    let inner_text = captures.get(1).map_or("", |c| c.as_str()).to_string();

                    let current_text = tokens[i].text.clone();
                    let before = current_text[..start].to_string();
                    let after = current_text[end..].to_string();
                    let mut new_marks = tokens[i].marks.clone();

                    let mut mark_obj = json!({ "type": mark_type });
                    if let Some(ref attrs) = mark_attrs {
                        mark_obj["attrs"] = attrs.clone();
                    }
                    new_marks.push(mark_obj);

                    let mut replacements = vec![];
                    if !before.is_empty() {
                        replacements.push(Token { text: before, marks: tokens[i].marks.clone() });
                    }
                    if !inner_text.is_empty() {
                        replacements.push(Token { text: inner_text, marks: new_marks });
                    }
                    if !after.is_empty() {
                        replacements.push(Token { text: after, marks: tokens[i].marks.clone() });
                    }

                    tokens.splice(i..i + 1, replacements);
                    continue;
                }
            }
            i += 1;
        }
    };

    // 1. Inline Code
    apply_mark(&mut tokens, r"`([^`]+)`", "code", None);

    // 2. Bold
    apply_mark(&mut tokens, r"\*\*([^*]+)\*\*", "bold", None);

    // 3. Italic
    apply_mark(&mut tokens, r"(?<!\*)\*([^*]+)\*(?!\*)", "italic", None);

    // 4. Underline
    apply_mark(&mut tokens, r"(?i)<u>(.*?)</u>", "underline", None);

    // 5. Strike
    apply_mark(&mut tokens, r"~~(.*?)~~", "strike", None);

    // 6. Links [text](url)
    if let Ok(re) = regex::Regex::new(r"\[([^\]]+)\]\(([^)]+)\)") {
        let mut i = 0;
        while i < tokens.len() {
            if let Some(captures) = re.captures(&tokens[i].text) {
                if let Some(m) = captures.get(0) {
                    let start = m.start();
                    let end = m.end();
                    let link_text = captures.get(1).map_or("", |c| c.as_str()).to_string();
                    let link_url = captures.get(2).map_or("", |c| c.as_str()).to_string();

                    let current_text = tokens[i].text.clone();
                    let before = current_text[..start].to_string();
                    let after = current_text[end..].to_string();
                    let mut new_marks = tokens[i].marks.clone();
                    new_marks.push(json!({
                        "type": "link",
                        "attrs": { "href": link_url, "target": "_blank" }
                    }));

                    let mut replacements = vec![];
                    if !before.is_empty() {
                        replacements.push(Token { text: before, marks: tokens[i].marks.clone() });
                    }
                    if !link_text.is_empty() {
                        replacements.push(Token { text: link_text, marks: new_marks });
                    }
                    if !after.is_empty() {
                        replacements.push(Token { text: after, marks: tokens[i].marks.clone() });
                    }

                    tokens.splice(i..i + 1, replacements);
                    continue;
                }
            }
            i += 1;
        }
    }

    tokens
        .into_iter()
        .filter(|t| !t.text.is_empty())
        .map(|t| {
            if t.marks.is_empty() {
                json!({ "type": "text", "text": t.text })
            } else {
                json!({ "type": "text", "text": t.text, "marks": t.marks })
            }
        })
        .collect()
}

pub fn markdown_to_tiptap_json(markdown: &str) -> String {
    let lines: Vec<&str> = markdown.lines().collect();
    let mut nodes: Vec<Value> = Vec::new();
    let mut i = 0;

    while i < lines.len() {
        let line = lines[i];

        if line.trim().is_empty() {
            i += 1;
            continue;
        }

        // 1. Code Block (Fenced)
        if line.trim().starts_with("```") {
            let lang = line.trim().trim_start_matches('`').trim();
            let mut code_lines = Vec::new();
            i += 1;
            while i < lines.len() && !lines[i].trim().starts_with("```") {
                code_lines.push(lines[i]);
                i += 1;
            }
            if i < lines.len() {
                i += 1; // Skip closing ```
            }

            let code_text = code_lines.join("\n");
            let mut code_block = json!({
                "type": "codeBlock",
                "attrs": { "language": if lang.is_empty() { Value::Null } else { json!(lang) } }
            });
            if !code_text.is_empty() {
                code_block["content"] = json!([{ "type": "text", "text": code_text }]);
            }
            nodes.push(code_block);
            continue;
        }

        // 2. Table Block
        if line.trim().starts_with('|') && line.trim().ends_with('|') {
            let mut table_rows: Vec<&str> = Vec::new();
            while i < lines.len() && lines[i].trim().starts_with('|') && lines[i].trim().ends_with('|') {
                table_rows.push(lines[i].trim());
                i += 1;
            }

            let mut parsed_rows: Vec<Vec<String>> = Vec::new();
            let mut is_header_separator_present = false;

            for row_str in table_rows {
                let trimmed = row_str.trim();
                let inner = &trimmed[1..trimmed.len() - 1];
                let is_sep = inner.split('|').all(|c| c.trim().chars().all(|ch| ch == '-' || ch == ':'));
                if is_sep {
                    is_header_separator_present = true;
                    continue;
                }
                let cells: Vec<String> = inner.split('|').map(|c| c.trim().to_string()).collect();
                parsed_rows.push(cells);
            }

            if !parsed_rows.is_empty() {
                let mut row_nodes: Vec<Value> = Vec::new();
                for (r_idx, cells) in parsed_rows.into_iter().enumerate() {
                    let is_header = is_header_separator_present && r_idx == 0;
                    let cell_type = if is_header { "tableHeader" } else { "tableCell" };

                    let mut cell_nodes = Vec::new();
                    for cell_text in cells {
                        let inline_nodes = parse_inline_formatting(&cell_text);
                        let paragraph = if inline_nodes.is_empty() {
                            json!({ "type": "paragraph" })
                        } else {
                            json!({ "type": "paragraph", "content": inline_nodes })
                        };

                        cell_nodes.push(json!({
                            "type": cell_type,
                            "attrs": {
                                "colspan": 1,
                                "rowspan": 1,
                                "colwidth": Value::Null,
                                "align": Value::Null
                            },
                            "content": [paragraph]
                        }));
                    }

                    row_nodes.push(json!({
                        "type": "tableRow",
                        "content": cell_nodes
                    }));
                }

                nodes.push(json!({
                    "type": "table",
                    "content": row_nodes
                }));
            }
            continue;
        }

        // 3. Task List
        if let Some(_caps) = regex::Regex::new(r"^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$").ok().and_then(|re| re.captures(line)) {
            let mut task_items = Vec::new();

            while i < lines.len() {
                if let Some(task_caps) = regex::Regex::new(r"^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$").ok().and_then(|re| re.captures(lines[i])) {
                    let is_checked = task_caps.get(2).map_or(false, |c| c.as_str().eq_ignore_ascii_case("x"));
                    let task_text = task_caps.get(3).map_or("", |c| c.as_str());
                    let inline_nodes = parse_inline_formatting(task_text);

                    let para = if inline_nodes.is_empty() {
                        json!({ "type": "paragraph" })
                    } else {
                        json!({ "type": "paragraph", "content": inline_nodes })
                    };

                    task_items.push(json!({
                        "type": "taskItem",
                        "attrs": { "checked": is_checked },
                        "content": [para]
                    }));
                    i += 1;
                } else {
                    break;
                }
            }

            nodes.push(json!({
                "type": "taskList",
                "content": task_items
            }));
            continue;
        }

        // 4. Bullet List
        if line.trim().starts_with("- ") || line.trim().starts_with("* ") || line.trim().starts_with("+ ") {
            let mut list_items = Vec::new();
            while i < lines.len() {
                let cur = lines[i].trim();
                if (cur.starts_with("- ") || cur.starts_with("* ") || cur.starts_with("+ ")) && !cur.contains("[ ]") && !cur.contains("[x]") && !cur.contains("[X]") {
                    let item_text = &cur[2..];
                    let inline_nodes = parse_inline_formatting(item_text);
                    let para = if inline_nodes.is_empty() {
                        json!({ "type": "paragraph" })
                    } else {
                        json!({ "type": "paragraph", "content": inline_nodes })
                    };
                    list_items.push(json!({
                        "type": "listItem",
                        "content": [para]
                    }));
                    i += 1;
                } else {
                    break;
                }
            }

            nodes.push(json!({
                "type": "bulletList",
                "content": list_items
            }));
            continue;
        }

        // 5. Heading (#)
        if line.starts_with('#') {
            let level = line.chars().take_while(|c| *c == '#').count();
            if level >= 1 && level <= 6 {
                let heading_text = line[level..].trim();
                let inline_nodes = parse_inline_formatting(heading_text);
                let mut heading_node = json!({
                    "type": "heading",
                    "attrs": { "level": level }
                });
                if !inline_nodes.is_empty() {
                    heading_node["content"] = json!(inline_nodes);
                }
                nodes.push(heading_node);
                i += 1;
                continue;
            }
        }

        // 6. Horizontal Rule
        let trimmed_line = line.trim();
        if trimmed_line == "---" || trimmed_line == "***" || trimmed_line == "___" {
            nodes.push(json!({ "type": "horizontalRule" }));
            i += 1;
            continue;
        }

        // 7. Blockquote
        if line.trim().starts_with('>') {
            let mut quote_lines = Vec::new();
            while i < lines.len() && lines[i].trim().starts_with('>') {
                quote_lines.push(lines[i].trim().trim_start_matches('>').trim());
                i += 1;
            }
            let quote_text = quote_lines.join("\n");
            let inline_nodes = parse_inline_formatting(&quote_text);
            let para = if inline_nodes.is_empty() {
                json!({ "type": "paragraph" })
            } else {
                json!({ "type": "paragraph", "content": inline_nodes })
            };
            nodes.push(json!({
                "type": "blockquote",
                "content": [para]
            }));
            continue;
        }

        // 8. Standard Paragraph
        let inline_nodes = parse_inline_formatting(line);
        let para = if inline_nodes.is_empty() {
            json!({ "type": "paragraph" })
        } else {
            json!({ "type": "paragraph", "content": inline_nodes })
        };
        nodes.push(para);
        i += 1;
    }

    if nodes.is_empty() {
        nodes.push(json!({ "type": "paragraph" }));
    }

    json!({
        "type": "doc",
        "content": nodes
    }).to_string()
}

// ---------------------------------------------------------------------------
// Checklist Utilities
// ---------------------------------------------------------------------------

pub fn extract_checklist(raw: &str) -> Vec<ChecklistItem> {
    let mut items = Vec::new();
    let re = regex::Regex::new(r"^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$").unwrap();

    for (line_num, line) in raw.lines().enumerate() {
        if let Some(caps) = re.captures(line) {
            let checked = caps.get(2).map_or(false, |c| c.as_str().eq_ignore_ascii_case("x"));
            let text = caps.get(3).map_or("", |c| c.as_str()).trim().to_string();
            items.push(ChecklistItem {
                index: items.len(),
                text,
                checked,
                line_number: line_num + 1,
            });
        }
    }
    items
}

pub fn update_checklist_item(
    raw: &str,
    index: Option<usize>,
    match_text: Option<&str>,
    set_checked: Option<bool>,
) -> (String, Option<ChecklistItem>) {
    let mut lines: Vec<String> = raw.lines().map(|s| s.to_string()).collect();
    let re = regex::Regex::new(r"^(\s*)[-*+]\s+\[([ xX])\]\s*(.*)$").unwrap();
    let mut item_counter = 0;
    let mut modified: Option<ChecklistItem> = None;

    for (i, line) in lines.iter_mut().enumerate() {
        if let Some(caps) = re.captures(line) {
            let cur_checked = caps.get(2).map_or(false, |c| c.as_str().eq_ignore_ascii_case("x"));
            let cur_text = caps.get(3).map_or("", |c| c.as_str()).trim().to_string();
            let cur_index = item_counter;
            item_counter += 1;

            let is_target = if let Some(target_idx) = index {
                target_idx == cur_index
            } else if let Some(target_txt) = match_text {
                cur_text.to_lowercase().contains(&target_txt.to_lowercase())
            } else {
                false
            };

            if is_target {
                let next_checked = set_checked.unwrap_or(!cur_checked);
                let box_char = if next_checked { "x" } else { " " };
                let indent = caps.get(1).map_or("", |c| c.as_str());
                *line = format!("{}- [{}] {}", indent, box_char, cur_text);
                modified = Some(ChecklistItem {
                    index: cur_index,
                    text: cur_text,
                    checked: next_checked,
                    line_number: i + 1,
                });
                break;
            }
        }
    }

    (lines.join("\n"), modified)
}

pub fn add_checklist_item(raw: &str, task_text: &str, checked: bool) -> (String, ChecklistItem) {
    let box_str = if checked { "[x]" } else { "[ ]" };
    let new_line = format!("- {} {}", box_str, task_text.trim());
    let updated = if raw.trim().is_empty() {
        new_line
    } else {
        format!("{}\n{}", raw.trim_end(), new_line)
    };

    let items = extract_checklist(&updated);
    let new_item = items.last().cloned().unwrap();
    (updated, new_item)
}

// ---------------------------------------------------------------------------
// Native Rust MCP Server (stdio JSON-RPC 2.0)
// ---------------------------------------------------------------------------

pub fn run_mcp_server() {
    let db = match Database::new() {
        Ok(d) => d,
        Err(e) => {
            eprintln!("Error connecting to VibeNotes SQLite database: {}", e);
            std::process::exit(1);
        }
    };

    let stdin = io::stdin();
    let stdout = io::stdout();
    let mut handle = stdout.lock();

    for line in stdin.lock().lines() {
        let Ok(line_str) = line else { break; };
        if line_str.trim().is_empty() { continue; };

        let Ok(req): Result<Value, _> = serde_json::from_str(&line_str) else {
            continue;
        };

        let req_id = req.get("id").cloned();
        let method = req.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = req.get("params").cloned().unwrap_or(json!({}));

        let response = match method {
            "initialize" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "serverInfo": {
                            "name": "vibenotes",
                            "version": "0.2.0"
                        },
                        "capabilities": {
                            "tools": {},
                            "resources": {},
                            "prompts": {}
                        }
                    }
                })
            }
            "notifications/initialized" => {
                // Client initialized notification, no response required
                continue;
            }
            "ping" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {}
                })
            }
            "tools/list" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": [
                            {
                                "name": "create_note",
                                "description": "Create a new floating sticky note with rich markdown (tables, syntax-highlighted code blocks, checklists `- [ ]`/`- [x]`, formatting, themes). Automatically renders in the VibeNotes desktop app.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "content": { "type": "string", "description": "Markdown content of the note" },
                                        "title": { "type": "string", "description": "Optional title for the note" },
                                        "color_theme": { "type": "string", "enum": ["yellow", "green", "pink", "purple", "blue", "charcoal", "grey"], "description": "Note background theme color" },
                                        "is_pinned": { "type": "boolean", "description": "Pin note to top of notes list" },
                                        "is_always_on_top": { "type": "boolean", "description": "Float note above other windows" }
                                    },
                                    "required": ["content"]
                                }
                            },
                            {
                                "name": "update_note",
                                "description": "Update an existing sticky note content (with markdown tables, code blocks, checklists), title, color theme, or pin status.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "id": { "type": "string", "description": "The unique ID of the sticky note" },
                                        "content": { "type": "string", "description": "New Markdown content for the note" },
                                        "title": { "type": "string", "description": "New title for the note" },
                                        "color_theme": { "type": "string", "enum": ["yellow", "green", "pink", "purple", "blue", "charcoal", "grey"] },
                                        "is_pinned": { "type": "boolean" },
                                        "is_always_on_top": { "type": "boolean" }
                                    },
                                    "required": ["id"]
                                }
                            },
                            {
                                "name": "append_note_content",
                                "description": "Append markdown text, sections, code blocks, tables, or task items to an existing note.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "id": { "type": "string", "description": "The unique ID of the sticky note" },
                                        "content": { "type": "string", "description": "Markdown content to append" }
                                    },
                                    "required": ["id", "content"]
                                }
                            },
                            {
                                "name": "manage_checklist",
                                "description": "Manage checklist / task items in a sticky note (list tasks, check done, uncheck, toggle, or add item).",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "id": { "type": "string", "description": "The unique ID of the sticky note" },
                                        "action": { "type": "string", "enum": ["list", "check", "uncheck", "toggle", "add_item"] },
                                        "item_index": { "type": "integer", "description": "0-based index of the task item" },
                                        "item_text": { "type": "string", "description": "Substring match for task text" },
                                        "new_item_text": { "type": "string", "description": "Text for new checklist item when action is add_item" }
                                    },
                                    "required": ["id", "action"]
                                }
                            },
                            {
                                "name": "list_notes",
                                "description": "List sticky notes with filtering (search, color theme, archived status) and task completion metrics.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "include_archived": { "type": "boolean", "description": "Include archived notes" },
                                        "color_theme": { "type": "string", "description": "Color theme filter" },
                                        "search": { "type": "string", "description": "Search query" }
                                    }
                                }
                            },
                            {
                                "name": "get_note",
                                "description": "Retrieve complete details, raw markdown, and checklist breakdown for a sticky note.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "id": { "type": "string", "description": "The unique ID of the sticky note" }
                                    },
                                    "required": ["id"]
                                }
                            },
                            {
                                "name": "delete_note",
                                "description": "Remove a sticky note. Archives by default, or permanent delete if permanent=true.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "id": { "type": "string", "description": "The unique ID of the sticky note" },
                                        "permanent": { "type": "boolean", "description": "Permanently destroy from database" }
                                    },
                                    "required": ["id"]
                                }
                            },
                            {
                                "name": "restore_note",
                                "description": "Restore an archived sticky note back to active status.",
                                "inputSchema": {
                                    "type": "object",
                                    "properties": {
                                        "id": { "type": "string", "description": "The unique ID of the archived sticky note" }
                                    },
                                    "required": ["id"]
                                }
                            }
                        ]
                    }
                })
            }
            "tools/call" => {
                let tool_name = params.get("name").and_then(|n| n.as_str()).unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));

                match tool_name {
                    "create_note" => {
                        let content = args.get("content").and_then(|c| c.as_str()).unwrap_or("");
                        let title = args.get("title").and_then(|t| t.as_str()).map(|s| s.to_string());
                        let theme = args.get("color_theme").and_then(|t| t.as_str()).unwrap_or("yellow").to_string();
                        let is_pinned = args.get("is_pinned").and_then(|p| p.as_bool()).unwrap_or(false);
                        let is_always_on_top = args.get("is_always_on_top").and_then(|p| p.as_bool()).unwrap_or(false);

                        let json_content = markdown_to_tiptap_json(content);

                        match db.create_note(Some(theme.clone()), None, None) {
                            Ok(note) => {
                                let _ = db.update_note_content(
                                    &note.id,
                                    title.as_deref(),
                                    content,
                                    &json_content,
                                    None, None, None, None
                                );
                                if is_pinned {
                                    let _ = db.set_note_pinned_status(&note.id, true);
                                }
                                if is_always_on_top {
                                    let _ = db.set_note_always_on_top(&note.id, true);
                                }

                                let fetched = db.get_note_by_id(&note.id).ok().flatten().unwrap_or(note);

                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "content": [
                                            {
                                                "type": "text",
                                                "text": format!("Sticky note created successfully!\n\nID: {}\nTitle: {}\nTheme: {}\n\nContent:\n{}", fetched.id, fetched.title, fetched.color_theme, fetched.content_raw)
                                            }
                                        ]
                                    }
                                })
                            }
                            Err(e) => {
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "isError": true,
                                        "content": [{ "type": "text", "text": format!("Failed to create note: {}", e) }]
                                    }
                                })
                            }
                        }
                    }
                    "update_note" => {
                        let id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        match db.get_note_by_id(id) {
                            Ok(Some(existing)) => {
                                let new_content = args.get("content").and_then(|c| c.as_str()).unwrap_or(&existing.content_raw);
                                let json_content = markdown_to_tiptap_json(new_content);
                                let title = args.get("title").and_then(|t| t.as_str());
                                let _ = db.update_note_content(&existing.id, title, new_content, &json_content, None, None, None, None);

                                if let Some(theme) = args.get("color_theme").and_then(|t| t.as_str()) {
                                    let _ = db.set_note_theme(&existing.id, theme);
                                }
                                if let Some(pinned) = args.get("is_pinned").and_then(|p| p.as_bool()) {
                                    let _ = db.set_note_pinned_status(&existing.id, pinned);
                                }
                                if let Some(always_on_top) = args.get("is_always_on_top").and_then(|p| p.as_bool()) {
                                    let _ = db.set_note_always_on_top(&existing.id, always_on_top);
                                }

                                let updated = db.get_note_by_id(id).ok().flatten().unwrap_or(existing);
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "content": [
                                            {
                                                "type": "text",
                                                "text": format!("Sticky note '{}' updated successfully!\n\nTitle: {}\nTheme: {}\n\nContent:\n{}", updated.id, updated.title, updated.color_theme, updated.content_raw)
                                            }
                                        ]
                                    }
                                })
                            }
                            _ => {
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "isError": true,
                                        "content": [{ "type": "text", "text": format!("Note with ID '{}' not found.", id) }]
                                    }
                                })
                            }
                        }
                    }
                    "append_note_content" => {
                        let id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let append_text = args.get("content").and_then(|c| c.as_str()).unwrap_or("");

                        match db.get_note_by_id(id) {
                            Ok(Some(existing)) => {
                                let new_raw = format!("{}\n\n{}", existing.content_raw.trim_end(), append_text.trim_start());
                                let json_content = markdown_to_tiptap_json(&new_raw);
                                let _ = db.update_note_content(&existing.id, None, &new_raw, &json_content, None, None, None, None);

                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "content": [
                                            {
                                                "type": "text",
                                                "text": format!("Content appended to note '{}'.\n\nUpdated Content:\n{}", id, new_raw)
                                            }
                                        ]
                                    }
                                })
                            }
                            _ => {
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "isError": true,
                                        "content": [{ "type": "text", "text": format!("Note with ID '{}' not found.", id) }]
                                    }
                                })
                            }
                        }
                    }
                    "manage_checklist" => {
                        let id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let action = args.get("action").and_then(|a| a.as_str()).unwrap_or("list");

                        match db.get_note_by_id(id) {
                            Ok(Some(existing)) => {
                                if action == "list" {
                                    let tasks = extract_checklist(&existing.content_raw);
                                    let completed = tasks.iter().filter(|t| t.checked).count();
                                    json!({
                                        "jsonrpc": "2.0",
                                        "id": req_id,
                                        "result": {
                                            "content": [{
                                                "type": "text",
                                                "text": json!({
                                                    "note_id": id,
                                                    "total": tasks.len(),
                                                    "completed": completed,
                                                    "tasks": tasks
                                                }).to_string()
                                            }]
                                        }
                                    })
                                } else if action == "add_item" {
                                    let new_text = args.get("new_item_text").and_then(|t| t.as_str()).unwrap_or("");
                                    let (updated_text, new_item) = add_checklist_item(&existing.content_raw, new_text, false);
                                    let json_content = markdown_to_tiptap_json(&updated_text);
                                    let _ = db.update_note_content(&existing.id, None, &updated_text, &json_content, None, None, None, None);

                                    json!({
                                        "jsonrpc": "2.0",
                                        "id": req_id,
                                        "result": {
                                            "content": [{
                                                "type": "text",
                                                "text": format!("Added checklist item: \"{}\" (index: {})\n\nUpdated Note Content:\n{}", new_item.text, new_item.index, updated_text)
                                            }]
                                        }
                                    })
                                } else {
                                    let desired = match action {
                                        "check" => Some(true),
                                        "uncheck" => Some(false),
                                        _ => None,
                                    };
                                    let item_idx = args.get("item_index").and_then(|i| i.as_u64()).map(|u| u as usize);
                                    let match_txt = args.get("item_text").and_then(|t| t.as_str());

                                    let (updated_text, modified) = update_checklist_item(&existing.content_raw, item_idx, match_txt, desired);
                                    if let Some(mod_item) = modified {
                                        let json_content = markdown_to_tiptap_json(&updated_text);
                                        let _ = db.update_note_content(&existing.id, None, &updated_text, &json_content, None, None, None, None);

                                        json!({
                                            "jsonrpc": "2.0",
                                            "id": req_id,
                                            "result": {
                                                "content": [{
                                                    "type": "text",
                                                    "text": format!("Checklist item updated!\nTask: \"{}\"\nStatus: {}\n\nUpdated Note Content:\n{}", mod_item.text, if mod_item.checked { "COMPLETED [x]" } else { "PENDING [ ]" }, updated_text)
                                                }]
                                            }
                                        })
                                    } else {
                                        json!({
                                            "jsonrpc": "2.0",
                                            "id": req_id,
                                            "result": {
                                                "isError": true,
                                                "content": [{ "type": "text", "text": "No matching checklist item found." }]
                                            }
                                        })
                                    }
                                }
                            }
                            _ => {
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "isError": true,
                                        "content": [{ "type": "text", "text": format!("Note with ID '{}' not found.", id) }]
                                    }
                                })
                            }
                        }
                    }
                    "list_notes" => {
                        let include_archived = args.get("include_archived").and_then(|a| a.as_bool()).unwrap_or(false);
                        let search = args.get("search").and_then(|s| s.as_str()).map(|s| s.to_lowercase());
                        let color_theme = args.get("color_theme").and_then(|t| t.as_str());

                        let notes: Vec<Note> = db.get_all_notes(include_archived).unwrap_or_default();
                        let filtered: Vec<Value> = notes.into_iter().filter(|n| {
                            if let Some(ref theme) = color_theme {
                                if *theme != "all" && n.color_theme != *theme {
                                    return false;
                                }
                            }
                            if let Some(ref q) = search {
                                if !n.title.to_lowercase().contains(q) && !n.content_raw.to_lowercase().contains(q) {
                                    return false;
                                }
                            }
                            true
                        }).map(|n| {
                            let tasks = extract_checklist(&n.content_raw);
                            let completed = tasks.iter().filter(|t| t.checked).count();
                            let preview = n.content_raw.lines().next().unwrap_or("").chars().take(80).collect::<String>();
                            json!({
                                "id": n.id,
                                "title": n.title,
                                "color_theme": n.color_theme,
                                "is_pinned": n.is_pinned,
                                "is_open": n.is_open,
                                "is_archived": n.is_archived,
                                "preview": preview,
                                "tasks": if !tasks.is_empty() {
                                    json!({ "total": tasks.len(), "completed": completed, "pending": tasks.len() - completed })
                                } else {
                                    Value::Null
                                },
                                "updated_at": n.updated_at
                            })
                        }).collect();

                        json!({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "result": {
                                "content": [{
                                    "type": "text",
                                    "text": serde_json::to_string_pretty(&filtered).unwrap_or_default()
                                }]
                            }
                        })
                    }
                    "get_note" => {
                        let id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        match db.get_note_by_id(id) {
                            Ok(Some(note)) => {
                                let tasks = extract_checklist(&note.content_raw);
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "content": [{
                                            "type": "text",
                                            "text": json!({
                                                "id": note.id,
                                                "title": note.title,
                                                "color_theme": note.color_theme,
                                                "is_pinned": note.is_pinned,
                                                "is_always_on_top": note.is_always_on_top,
                                                "is_open": note.is_open,
                                                "is_archived": note.is_archived,
                                                "content": note.content_raw,
                                                "checklist": if !tasks.is_empty() { json!(tasks) } else { Value::Null },
                                                "created_at": note.created_at,
                                                "updated_at": note.updated_at
                                            }).to_string()
                                        }]
                                    }
                                })
                            }
                            _ => {
                                json!({
                                    "jsonrpc": "2.0",
                                    "id": req_id,
                                    "result": {
                                        "isError": true,
                                        "content": [{ "type": "text", "text": format!("Note with ID '{}' not found.", id) }]
                                    }
                                })
                            }
                        }
                    }
                    "delete_note" => {
                        let id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let permanent = args.get("permanent").and_then(|p| p.as_bool()).unwrap_or(false);

                        if permanent {
                            let _ = db.delete_note_permanent(id);
                            json!({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "result": {
                                    "content": [{
                                        "type": "text",
                                        "text": format!("Note '{}' permanently deleted from database.", id)
                                    }]
                                }
                            })
                        } else {
                            let _ = db.set_note_archived(id, true);
                            json!({
                                "jsonrpc": "2.0",
                                "id": req_id,
                                "result": {
                                    "content": [{
                                        "type": "text",
                                        "text": format!("Note '{}' moved to archive. Restore anytime with 'restore_note'.", id)
                                    }]
                                }
                            })
                        }
                    }
                    "restore_note" => {
                        let id = args.get("id").and_then(|i| i.as_str()).unwrap_or("");
                        let _ = db.set_note_archived(id, false);
                        json!({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "result": {
                                "content": [{
                                    "type": "text",
                                    "text": format!("Note '{}' restored to active sticky notes!", id)
                                }]
                            }
                        })
                    }
                    _ => {
                        json!({
                            "jsonrpc": "2.0",
                            "id": req_id,
                            "error": {
                                "code": -32601,
                                "message": format!("Method or tool '{}' not found", tool_name)
                            }
                        })
                    }
                }
            }
            "resources/list" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "resources": [
                            {
                                "uri": "vibenotes://notes",
                                "name": "all_notes",
                                "description": "Markdown list of all active sticky notes",
                                "mimeType": "text/markdown"
                            }
                        ]
                    }
                })
            }
            "resources/read" => {
                let uri = params.get("uri").and_then(|u| u.as_str()).unwrap_or("");
                if uri == "vibenotes://notes" {
                    let notes = db.get_all_notes(false).unwrap_or_default();
                    let compiled = notes.into_iter().map(|n| format!("# {} (Theme: {})\nID: {}\n\n{}\n\n---", n.title, n.color_theme, n.id, n.content_raw)).collect::<Vec<_>>().join("\n\n");
                    json!({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {
                            "contents": [
                                {
                                    "uri": uri,
                                    "mimeType": "text/markdown",
                                    "text": compiled
                                }
                            ]
                        }
                    })
                } else {
                    json!({
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {
                            "code": -32602,
                            "message": "Resource not found"
                        }
                    })
                }
            }
            "prompts/list" => {
                json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "prompts": [
                            {
                                "name": "summarize_notes",
                                "description": "Summarize all active sticky notes",
                                "arguments": []
                            },
                            {
                                "name": "review_tasks",
                                "description": "Review all tasks and checklists across sticky notes",
                                "arguments": []
                            }
                        ]
                    }
                })
            }
            _ => {
                json!({
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {
                        "code": -32601,
                        "message": format!("Unknown method: {}", method)
                    }
                })
            }
        };

        let res_str = response.to_string();
        let _ = writeln!(handle, "{}", res_str);
        let _ = handle.flush();
    }
}
