# 🤖 VibeNotes Model Context Protocol (MCP) Server

Connect **VibeNotes** to any AI coding assistant or autonomous agent via the official [Model Context Protocol (MCP)](https://modelcontextprotocol.io/).

With the VibeNotes MCP Server, your AI assistant can directly manage your desktop sticky notes in real time:
- 📝 **Create rich sticky notes** with custom titles, colors, and pin settings.
- 💻 **Syntax-highlighted code blocks** (Rust, TypeScript, Python, SQL, etc.) that open natively in the VibeNotes app.
- 📊 **Markdown tables** with automatic formatting and columns.
- ☑️ **Interactive checklists** with direct task completion and toggling.
- 🔍 **Search and inspect notes** across your desktop workspace.
- 🗄️ **Archive, delete, and restore notes**.

---

## 🚀 Setup Options

You can run the VibeNotes MCP Server in two ways:

### Option A: Embedded Standalone Executable (Recommended for Standalone App)
No Node.js or runtime installation required! The compiled `vibenotes.exe` includes a high-performance native Rust MCP server triggered with the `--mcp` flag:

```json
{
  "mcpServers": {
    "vibenotes": {
      "command": "C:/Program Files/VibeNotes/vibenotes.exe",
      "args": ["--mcp"]
    }
  }
}
```
*(Or in development: `src-tauri/target/release/vibenotes.exe` with args `["--mcp"]`)*

### Option B: Node.js / TypeScript Server
Ideal for developer workflows with Node.js installed:

```bash
npm run mcp:build
```

```json
{
  "mcpServers": {
    "vibenotes": {
      "command": "node",
      "args": ["YOURCODEPATH/VibeNotes/mcp-server/dist/index.js"]
    }
  }
}
```

---

## ⚙️ Client Configurations

### 1. Claude Desktop (`claude_desktop_config.json`)

Location: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "vibenotes": {
      "command": "C:/Program Files/VibeNotes/vibenotes.exe",
      "args": ["--mcp"]
    }
  }
}
```

### 2. Google Antigravity & Cursor (`mcp.json`)

Add to `.gemini/antigravity/mcp.json` or `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "vibenotes": {
      "command": "C:/Program Files/VibeNotes/vibenotes.exe",
      "args": ["--mcp"]
    }
  }
}
```

### 3. Claude Code CLI (`claude mcp add`)

```bash
claude mcp add vibenotes -- "C:/Program Files/VibeNotes/vibenotes.exe" --mcp
```

### 4. Cline / Roo Code / Windsurf

Add to your MCP Settings:

```json
{
  "mcpServers": {
    "vibenotes": {
      "command": "C:/Program Files/VibeNotes/vibenotes.exe",
      "args": ["--mcp"],
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

> [!TIP]
> If you are developing locally without installing, you can substitute `"C:/Program Files/VibeNotes/vibenotes.exe"` with your local build path: `"d:/Dev/VibeCoding/VibeNotes/src-tauri/target/release/vibenotes.exe"`.

---

## 🛠️ Available MCP Tools

| Tool Name | Description | Key Parameters |
| :--- | :--- | :--- |
| `create_note` | Creates a new floating sticky note with rich markdown. | `content` (markdown), `title` (optional), `color_theme` (yellow, green, pink, purple, blue, charcoal, grey), `is_pinned`, `is_always_on_top` |
| `update_note` | Updates content, title, color theme, or pin status of an existing note. | `id`, `content` (markdown), `title`, `color_theme`, `is_pinned`, `is_always_on_top` |
| `append_note_content` | Appends markdown text, code blocks, or tasks to an existing note. | `id`, `content` |
| `manage_checklist` | Manages tasks in a note (list, check done, uncheck, toggle, or add item). | `id`, `action` (`list`, `check`, `uncheck`, `toggle`, `add_item`), `item_index`, `item_text`, `new_item_text` |
| `list_notes` | Lists notes with search, color filtering, and task completion metrics. | `search`, `color_theme`, `include_archived` |
| `get_note` | Retrieves complete details, raw markdown, and checklist breakdown for a note. | `id` |
| `delete_note` | Removes a sticky note (archives by default, or permanent delete). | `id`, `permanent` (boolean, default: `false`) |
| `restore_note` | Restores an archived sticky note back to active status. | `id` |

---

## 📚 Dynamic Resources & Prompts

### Resources
- `vibenotes://notes`: Live markdown feed of all active sticky notes.
- `vibenotes://notes/{id}`: Live markdown content of a specific note by UUID.

### Prompts
- `summarize_notes`: Categorizes and summarizes all active sticky notes.
- `review_tasks`: Aggregates all pending (`- [ ]`) and completed (`- [x]`) tasks across all notes.

---

## 💡 Example AI Agent Workflows

Ask your AI assistant:
- *"Create a sticky note titled 'Sprint Tasks' in blue color with a checklist of today's deliverables."*
- *"Mark the task 'Deploy to staging' as done in my Sprint Tasks note."*
- *"Add a table comparing SQLite vs PostgreSQL to my Architecture note."*
- *"Create a charcoal note containing this Rust snippet with syntax highlighting."*
- *"List all my active sticky notes and show me pending tasks."*
- *"Archive the note titled 'Old Meeting Notes'."*
