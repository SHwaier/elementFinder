import * as vscode from 'vscode';
import { SelectionServer } from './server';
import * as fs from 'fs';
import * as path from 'path';

let server: SelectionServer | undefined;

/**
 * Finds the project root by searching for package.json upwards.
 */
function findProjectRoot(startPath: string): string | undefined {
	let current = startPath;
	while (current !== path.parse(current).root) {
		if (fs.existsSync(path.join(current, 'package.json'))) {
			return current;
		}
		current = path.dirname(current);
	}
	return undefined;
}

/**
 * Safely injects the script into a layout file.
 */
function injectIntoLayout(layoutPath: string): boolean {
    let content = fs.readFileSync(layoutPath, 'utf8');
    
    // 1. Add import Script from 'next/script' if missing
    if (!content.includes("'next/script'") && !content.includes('"next/script"')) {
        content = "import Script from 'next/script';\n" + content;
    }

    // 2. Prepare the injection block
    const injection = `
      {process.env.NODE_ENV === 'development' && (
        <Script src="http://localhost:3210/inject.js" strategy="afterInteractive" />
      )}`;

    // 3. Find the <body> tag and inject before </body>
    if (content.includes('</body>')) {
        if (!content.includes('http://localhost:3210/inject.js')) {
            content = content.replace('</body>', `${injection}\n      </body>`);
        } else {
            return false; // Already injected
        }
    } else {
        // Fallback for layouts without explicit body tag (unlikely in root layout)
        if (!content.includes('http://localhost:3210/inject.js')) {
            content += injection;
        } else {
            return false;
        }
    }

    fs.writeFileSync(layoutPath, content);
    return true;
}

export function activate(context: vscode.ExtensionContext) {
	console.log('AI Element Selector is now active!');

	server = new SelectionServer();

	// Command 1: Start Selector Server
	let launchDisposable = vscode.commands.registerCommand('ai-element-selector.launchSelector', async () => {
		if (server) {
			server.stop();
			server.start();
			
			const targetUrl = `http://localhost:3000`;
			vscode.env.openExternal(vscode.Uri.parse(targetUrl));
			vscode.window.showInformationMessage(`AI Selector active! Open your dev site at ${targetUrl}.`);
		}
	});

	// Command 2: Auto-Setup (Babel + Layout Injection + Cache Clean)
	let setupDisposable = vscode.commands.registerCommand('ai-element-selector.setupSourceMapping', async () => {
		let startPath: string | undefined;

		const activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			startPath = path.dirname(activeEditor.document.uri.fsPath);
		} else if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
			startPath = vscode.workspace.workspaceFolders[0].uri.fsPath;
		}

		if (!startPath) {
			vscode.window.showErrorMessage('No file or workspace open.');
			return;
		}

		const rootPath = findProjectRoot(startPath);
		if (!rootPath) {
			vscode.window.showErrorMessage('Could not find project root (package.json).');
			return;
		}

		// --- 1. Babel Setup (For mapping info) ---
		const babelRcPath = path.join(rootPath, '.babelrc');
		let babelConfig: any = { presets: ["next/babel"], plugins: [] };
		if (fs.existsSync(babelRcPath)) {
			try { babelConfig = JSON.parse(fs.readFileSync(babelRcPath, 'utf8')); } catch (e) {}
		}
		const pluginPath = path.join(context.extensionPath, 'packages', 'babel-plugin-source-mapper');
		if (!babelConfig.plugins) babelConfig.plugins = [];
		if (!babelConfig.presets) babelConfig.presets = [];
		if (!babelConfig.presets.includes("next/babel")) babelConfig.presets.unshift("next/babel");
		if (!babelConfig.plugins.includes(pluginPath)) {
			babelConfig.plugins.push(pluginPath);
			fs.writeFileSync(babelRcPath, JSON.stringify(babelConfig, null, 2));
		}

		// --- 2. Layout Injection (For Turbopack support) ---
		const appDirPath = path.join(rootPath, 'app');
		const layouts = ['layout.tsx', 'layout.js'];
		let layoutModified = false;
		for (const l of layouts) {
			const p = path.join(appDirPath, l);
			if (fs.existsSync(p)) {
				layoutModified = injectIntoLayout(p);
				break;
			}
		}

		// --- 3. Build Cache Clean ---
		const dotNextPath = path.join(rootPath, '.next');
		let cacheCleaned = false;
		if (fs.existsSync(dotNextPath)) {
			const cleanResponse = await vscode.window.showInformationMessage(
				'Detected existing build cache (.next). Clearing it can fix the "placeholder-url" error. Clear it now?',
				'Yes', 'No'
			);
			if (cleanResponse === 'Yes') {
				try {
					fs.rmSync(dotNextPath, { recursive: true, force: true });
					cacheCleaned = true;
				} catch (e) {
					vscode.window.showErrorMessage(`Failed to clear .next: ${e}`);
				}
			}
		}

		let msg = 'AI Element Selector setup complete!';
		if (layoutModified) msg += ' Injected Script into layout.tsx.';
		if (cacheCleaned) msg += ' Cleared build cache.';
		msg += ' Please RESTART your dev server (npm run dev).';
		
		vscode.window.showInformationMessage(msg);
	});

	// Command 3: Stop Selector Server
	let stopDisposable = vscode.commands.registerCommand('ai-element-selector.stopSelector', () => {
		if (server) {
			server.stop();
			vscode.window.showInformationMessage('Selector Server stopped.');
		}
	});

	context.subscriptions.push(launchDisposable, setupDisposable, stopDisposable);
}

export function deactivate() {
	if (server) {
		server.stop();
	}
}
