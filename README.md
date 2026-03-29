# 🚀 AI Element Selector

**Select elements in your browser. Jump to code in your editor. Generate rich AI prompts instantly.**

AI Element Selector is a "Zero-Config" developer tool designed for modern React and Next.js workflows. It bridges the gap between your browser and your editor (**Cursor, Antigravity, or VS Code**), allowing you to focus on building instead of hunting for files.

---

## ✨ Key Features

- **🎯 Zero-Config Injection**: Automatically integrates with your `app/layout.tsx`. No proxy servers or complex manual setups required.
- **⚡ Turbopack & Webpack Ready**: Fully compatible with Next.js 15+ and the latest Turbopack builds.
- **🔍 Smarter AI Context**: Every element you capture includes **10 lines of surrounding code** and **Sanitized React Props**, giving your AI (ChatGPT, Claude, Copilot) the full architectural context it needs.
- **🖱️ Hover & Click Selection**: Select any UI element with a blue highlight.
- **🏎️ Auto-Focus**: Instantly brings your editor to the front and opens the exact file and line when an element is captured.
- **⌨️ Interaction Bypass**: Hold **Alt** (or **Shift**) to temporarily disable the selector and interact with links or buttons normally.
- **🎨 Deeply Customizable**: Change highlight colors, modifier keys, and even create your own **Prompt Templates** in settings.

---

## 🛠️ Quick Start

### 1. Installation
Install the extension via the **"Extensions: Install from VSIX..."** command using the provided `ai-element-selector.vsix` file.

### 2. Project Setup
Open your Next.js project and run the following command from the Command Palette (`Cmd+Shift+P`):
> **`AI: Setup Source Mapping for Project`**

This will automatically add the necessary Babel plugin and layout injection to your project. (Note: Only runs in `development` mode).

### 3. Launch the Selector
Once your dev server is running (`npm run dev`), launch the selector:
> **`AI: Launch Selector (Zero-Config)`**

Open your web app (typically `localhost:3000`), and start clicking!

---

## ⚙️ Configuration

Press `Cmd+,` and search for **"AI Element Selector"** to customize:

- **Highlight Color**: Match the selector to your brand.
- **System Prompt**: Fine-tune the core instructions sent to the AI.
- **Task Placeholder**: Change `[User instruction here]` to your preferred boilerplate.
- **Custom Template**: Use variables like `{{tag}}`, `{{file}}`, `{{line}}`, and `{{props}}` to build your own prompt layout.
- **Auto-Focus**: Toggle whether the editor should jump to the front on click.

---

## 💡 Pro Tips

- **Clipboard Magic**: The prompt is automatically copied to your clipboard. Just hit `Cmd+V` in your AI chat.
- **Interaction**: If you need to click a link while the selector is active, just hold **Alt** (or your configured modifier key) to bypass the selector.

---

**Built for the future of agentic coding.** 🎯
