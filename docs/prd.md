# 🧠 PRD: AI Element Selector (Editor Extension)

**Version:** 2.1 (VSIX Professional)
**Type:** Editor Extension (with browser companion)
**Description:** A tool that allows developers to select UI elements in their browser and instantly jump to the corresponding source code in their editor (VS Code, Cursor, Antigravity, etc.), while generating rich context for AI prompts.

---

## 1. Problem Statement
When working on large React/Next.js projects, finding the exact file and line for a specific UI element can be tedious. Existing "Open in Editor" tools are often fragile, require complex proxy setups, or don't work with modern Turbopack/Next.js architectures.

---

## 2. The Solution
A "Zero-Config" extension that:
- **Automatically injects** a selector script into the web app using `app/layout.tsx`.
- **Maps browser elements** to source code using a dependency-free Babel plugin.
- **Opens the exact file** in the editor (VS Code, Cursor, etc.) via dynamic `appName` detection.
- **Generates a rich AI prompt** with code snippets, React props, and custom templates.

---

## 3. Core Features

### 3.1 Zero-Config Interspection
- **Babel Metadata**: Injects `data-source-file` and `data-source-line` into every JSX element.
- **Layout Injection**: No manual script tags. The extension modifies `app/layout.tsx` (in `development` only) to load the selector.
- **Turbopack Compatible**: Works perfectly with Next.js Turbopack because it uses layout-based injection instead of Babel-based injection.

### 3.2 Smarter Context for AI
- **Code Snippets**: Captains 10 lines of code around the selected element (5 before, 5 after) with the target line marked.
- **React Props**: Extracts and sanitizes React props (strings, numbers, booleans) from the Fiber tree.
- **Custom Templates**: Users can define their own prompt structure using `{{tag}}`, `{{file}}`, `{{line}}`, `{{props}}`, and `{{snippet}}`.

### 3.3 Visuals & Interaction
- **Advanced Selection**: Blue highlight box with customizable color.
- **Modifier Key Bypass**: Hold **Alt** (or **Shift**) to temporarily disable the selector and interact with the page.
- **Notification System**: Browser-side toast notifications for capture feedback.
- **Cross-Platform Auto-Focus**: Automatically brings the editor to the front when an element is captured.

---

## 4. Technical Architecture

### 4.1 Hub Server (`localhost:3210`)
A unified Node.js server that:
- Serves the `inject.js` script with dynamic VS Code settings injected.
- Manages a WebSocket connection for passing browser data back to the editor.

### 4.2 Babel Plugin (`packages/babel-plugin-source-mapper`)
- A self-contained, dependency-free plugin that injects JSX metadata.

### 4.3 Extension Backend
- Uses `vscode.env.appName` to ensure it works on **Cursor** and **Antigravity**.
- Uses `osascript`/`powershell`/`wmctrl` for cross-platform window switching.

---

## 5. Roadmap

### ✅ Phase 1: MVP (Next.js Support)
- Basic selection, file opening, and clipboard prompt.

### ✅ Phase 2: Smarter Context
- Snippets, Props, and Code windowing.

### ✅ Phase 3: Customization & VSIX
- VS Code Settings, Templates, and professional packaging.

### 🟡 Phase 4: Framework Expansion
- Add support for **Vite** and standard React projects.

### 🟡 Phase 5: Deep Visual Editing
- Inline text editing in the browser.
