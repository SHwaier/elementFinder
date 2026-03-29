# 🚀 AI Element Selector

**Select elements in your browser. Jump to code in your editor. Generate rich AI prompts instantly.**

AI Element Selector is a "Zero-Config" developer tool designed for modern web workflows. It bridges the gap between your browser and your editor (**Cursor, Antigravity, or VS Code**), allowing you to focus on building instead of hunting for files.

---

## ✨ Key Features

- **🎯 Universal Zero-Config**: Automatically detects and integrates with **Next.js**, **Vite (React/Vue)**, and **SvelteKit**.
- **⚡ Smart Injection**: Uses framework-optimized injection (Next.js `<Script>` or standard HTML `<script>`) to ensure it only runs in development.
- **🔍 Full AI Context**: Captures **10 lines of surrounding code** and **Sanitized React/SFC Props** for your AI (ChatGPT, Claude, Copilot).
- **🖱️ Visual Selection**: Blue highlight box with customizable colors.
- **🏎️ Auto-Focus**: Instantly brings your editor to the front and opens the exact file when an element is captured.
- **⌨️ Interaction Bypass**: Hold **Alt** (or **Shift**) to temporarily disable the selector and interact with links normally.

---

## 🛠️ Quick Start

### 1. Installation
Install the extension via the **"Extensions: Install from VSIX..."** command in your editor.

### 2. Project Setup
Open your project and run the following command from the Command Palette (`Cmd+Shift+P`):
> **`AI: Setup Source Mapping for Project`**

This will automatically detect your framework and:
- **Inject the Loader**: Adds the necessary script to `layout.tsx`, `index.html`, or `app.html`.
- **Configure Babel**: Adds the mapping plugin to your `.babelrc` (for JSX-based mapping).

### 3. Launch the Selector
Once your dev server is running (e.g., `npm run dev`), launch the selector:
> **`AI: Launch Selector (Zero-Config)`**

Open your app (typically `localhost:3000`), and start clicking!

---

## ⚡ Custom Entry Points (App.jsx, custom.tsx)
If you have a manual React setup using only `App.jsx` as your entry point, the **Babel Mapper** automatically handles the injection. 

As long as you have a `.babelrc` (which our setup command creates), the loader is **dynamically unshifted** into your component code during compilation. This means the selector will work instantly, even if your project doesn't have a standard `index.html` file in the root.

---

## 📦 Framework Support

| Framework | Entry Point | Source Mapping |
| :--- | :--- | :--- |
| **Next.js** | `app/layout.tsx` | Automated via Babel |
| **Vite (React)** | `index.html` | Automated via Babel |
| **Vue 3 (Vite)** | `index.html` | Manual (See below) |
| **SvelteKit** | `src/app.html` | Manual (See below) |

### 🔍 Non-JSX Source Mapping (Vue & Svelte)
For Vue templates and Svelte files, our automated Babel setup captures the element but may miss the exact file/line mapping. To enable 1-Click mapping for these frameworks, ensure your elements have the following metadata:
- `data-source-file`: Absolute path to the source file.
- `data-source-line`: Target line number.

### 🛠️ Manual Injection (The Universal Way)
If the auto-setup command fails to detect your framework, you can manually inject the selector script by adding this snippet to your root HTML or your main entry component (`App.jsx`, `main.tsx`):

```html
<!-- Add this to your root layout / index.html -->
<script>
  if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
    const script = document.createElement('script');
    script.src = 'http://localhost:3210/inject.js';
    script.async = true;
    document.head.appendChild(script);
  }
</script>
```

---
*(Tip: You can use existing community plugins like `vite-plugin-vue-inspector` or `vite-plugin-svelte-inspector` which provides similar metadata that our extension can often leverage.)*

---

## ⚙️ Configuration

Press `Cmd+,` and search for **"AI Element Selector"** to customize:

- **Highlight Color**: Match the selector to your brand.
- **System Prompt**: Fine-tune the core instructions sent to the AI.
- **Task Placeholder**: Change `[User instruction here]` to your preferred boilerplate.
- **Custom Template**: Use variables like `{{tag}}`, `{{file}}`, `{{line}}`, and `{{props}}`.
- **Auto-Focus**: Toggle whether the editor should jump to the front on click.

---

## 💡 Pro Tips

- **Clipboard Magic**: The prompt is automatically copied to your clipboard. Just hit `Cmd+V` in your AI chat.
- **Security**: The selector *only* runs on `localhost` and *only* when your dev server is active. It never sends data to external servers.

---

## 🛠️ Development & Building

If you are contributing to this project or want to build your own version:

1. **Clone & Install**:
   ```bash
   npm install
   ```
2. **Compile**:
   ```bash
   npm run compile
   ```
3. **Package as VSIX**:
   ```bash
   # Requires @vscode/vsce installed globally or via npx
   npx @vscode/vsce package
   ```
4. **Install Locally**:
   Go to **Extensions** in your editor, click the `...` menu, and select **Install from VSIX...** selecting the generated `.vsix` file.

---

**Built for the future of agentic coding.** 🎯
