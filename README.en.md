# Markdown Notebook

English | [简体中文](./README.md)

A local-first Markdown notebook project with file tree management, split editing/preview, full-text search, syntax highlighting, and auto-save. The frontend is built with `React + Vite`, and the backend is powered by `Express`. Notes are stored locally in the `notes/` directory by default.

## Features

- Live Markdown preview with GitHub Flavored Markdown support
- Syntax highlighting for code blocks
- Edit / Preview / Split view modes
- File tree browsing, rename, and delete
- Create notes and folders at the root or inside subfolders
- Full-text search across notes
- Auto-save and manual save
- Word, character, and line counters

## Tech Stack

- Frontend: `React 19`, `TypeScript`, `Vite`
- Backend: `Express 5`
- Markdown: `react-markdown`, `remark-gfm`, `rehype-highlight`

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Start in development mode

Start the backend first:

```bash
npm run server
```

The backend listens on `http://localhost:3001` by default.

Then start the frontend dev server in another terminal:

```bash
npm run dev
```

The frontend dev server runs on `http://127.0.0.1:5173` and accesses `/api` through the Vite proxy.

Use this URL during development:

```text
http://127.0.0.1:5173
```

### 3. Run the built app

```bash
npm run build
npm start
```

After building, `server.js` serves the frontend assets from `dist/`.

Open the built app at:

```text
http://localhost:3001
```

## Project Structure

```text
.
├── notes/                  # Local note storage
├── src/
│   ├── components/         # Sidebar / Editor / Preview / Search
│   ├── App.tsx             # Main app logic
│   └── index.css           # UI styles
├── server.js               # Local file API and static asset server
├── vite.config.ts          # Vite config and dev proxy
└── package.json
```

## Usage

### Current workflow

Recommended day-to-day workflow:

1. Run `npm install`
2. In terminal A, run `npm run server`
3. In terminal B, run `npm run dev`
4. Open `http://127.0.0.1:5173` in the browser
5. Edit notes in the UI; files are saved into the `notes/` directory

### URL behavior

- `http://127.0.0.1:5173`: frontend development environment with hot reload; use this during normal development
- `http://localhost:3001`: local backend service for file APIs; if `dist/` already exists, it also serves the built frontend page
- If you change code in `src/` without running `npm run build` again, the page on `3001` may still be the old built version
- Use `5173` for source-code development and `3001` for checking the built result

### Notes and folders

- Click `➕` in the sidebar header to create a note in the root directory
- Click `📁` in the sidebar header to create a folder in the root directory
- Hover a folder to create a note or a subfolder inside it
- Click a file to open it; click a folder to expand or collapse it
- Rename and delete are supported for both files and folders

### Important creation behavior

- After typing a file or folder name, you must press `Enter` to actually create it
- Typing a name without pressing `Enter` will not submit the creation
- New notes automatically get a `.md` extension if you do not enter one manually

### Editing and preview

- `Tab`: insert two spaces for indentation
- `Shift + Tab`: remove two leading spaces from the current line
- Switch freely between Edit, Preview, and Split modes
- Auto-save is enabled by default; manual save is also available via the button or shortcut

### Search

- Use `Ctrl/Cmd + F` to open full-text search
- Search scans `.md`, `.markdown`, and `.txt` files under `notes/`

## Shortcuts

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + S` | Save the current file |
| `Ctrl/Cmd + F` | Toggle search |
| `Tab` | Indent |
| `Shift + Tab` | Outdent |
| `Esc` | Close search or cancel the current input |

## Data Notes

- All notes are stored in the `notes/` directory by default
- The backend reads and writes directly to the local filesystem
- The current UI is primarily designed for Markdown and plain text files
- When moving the project to another computer, copy the full project folder and run `npm install` again there

## License

This project is released under the `MIT License`. See [LICENSE](./LICENSE) for details.
