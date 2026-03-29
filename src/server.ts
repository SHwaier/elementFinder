import * as ws from 'ws';
import * as vscode from 'vscode';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';

export class SelectionServer {
    private wss: ws.Server | undefined;
    private httpServer: http.Server | undefined;
    private port: number = 3210;

    constructor() {}

    public start(): void {
        const appName = vscode.env.appName;

        this.httpServer = http.createServer((req, res) => {
            if (req.url === '/inject.js') {
                const scriptPath = path.join(__dirname, '..', 'scripts', 'inject.js');
                try {
                    let script = fs.readFileSync(scriptPath, 'utf8');
                    const config = vscode.workspace.getConfiguration('ai-element-selector');
                    
                    // --- Dynamic Injection of Settings & Editor Name ---
                    script = script.replace(/{{HIGHLIGHT_COLOR}}/g, config.get<string>('highlightColor', 'rgba(0, 122, 255, 0.7)'));
                    script = script.replace(/{{MODIFIER_KEY}}/g, config.get<string>('modifierKey', 'Alt'));
                    script = script.replace(/{{SHOW_TOASTS}}/g, String(config.get<boolean>('showToasts', true)));
                    script = script.replace(/{{EDITOR_NAME}}/g, appName);

                    res.writeHead(200, {
                        'Content-Type': 'application/javascript',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': '*'
                    });
                    res.end(script);
                } catch (e) {
                    res.writeHead(404);
                    res.end('Not Found');
                }
            } else {
                res.writeHead(404);
                res.end('Not Found');
            }
        });

        this.wss = new ws.Server({ server: this.httpServer });
        
        this.wss.on('connection', (socket) => {
            console.log(`Browser connected to ${appName} Element Selector`);
            socket.on('message', (data) => {
                try {
                    const payload = JSON.parse(data.toString());
                    this.handlePayload(payload, appName);
                } catch (err) {
                    console.error('Failed to parse payload:', err);
                }
            });
        });

        this.httpServer.listen(this.port, () => {
            console.log(`${appName} Selector Server started on http://localhost:${this.port}`);
        });
        
        vscode.window.showInformationMessage(`${appName} Selector Server started on http://localhost:${this.port}.`);
    }

    public stop(): void {
        if (this.wss) this.wss.close();
        if (this.httpServer) this.httpServer.close();
    }

    private handlePayload(payload: any, appName: string): void {
        const { file, line, component, element } = payload;
        const config = vscode.workspace.getConfiguration('ai-element-selector');

        if (file && line) {
            const uri = vscode.Uri.file(file);
            vscode.workspace.openTextDocument(uri).then((doc) => {
                vscode.window.showTextDocument(doc, {
                    selection: new vscode.Range(line - 1, 0, line - 1, 0),
                    preview: false,
                    viewColumn: vscode.ViewColumn.One
                });
                
                if (config.get<boolean>('includeSnippet', true)) {
                    const range = config.get<number>('snippetRange', 5);
                    payload.snippet = this.readCodeSnippet(file, line, range);
                }

                const prompt = this.generatePrompt(payload, config, appName);
                vscode.env.clipboard.writeText(prompt);

                if (config.get<boolean>('autoFocus', true)) {
                    this.refocusWindow(appName);
                }

                vscode.window.showInformationMessage(`Element captured: ${component || element}`);
            }, (err) => {
                const prompt = this.generatePrompt(payload, config, appName);
                vscode.env.clipboard.writeText(prompt);
            });
        } else {
            const prompt = this.generatePrompt(payload, config, appName);
            vscode.env.clipboard.writeText(prompt);
            vscode.window.showWarningMessage('Element captured for AI (Mapping missing).');
        }
    }

    private readCodeSnippet(filePath: string, targetLine: number, range: number): string {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split(/\r?\n/);
            const start = Math.max(0, targetLine - (range + 1));
            const end = Math.min(lines.length, targetLine + range);
            const snippetLines = lines.slice(start, end).map((line, index) => {
                const currentLineNum = start + index + 1;
                const marker = currentLineNum === targetLine ? ' > ' : '   ';
                return `${marker}${currentLineNum} | ${line}`;
            });
            return snippetLines.join('\n');
        } catch (e) {
            return '';
        }
    }

    private refocusWindow(appName: string): void {
        const platform = process.platform;
        if (platform === 'darwin') {
            exec(`osascript -e "tell application \\"${appName}\\" to activate"`);
        } else if (platform === 'win32') {
            exec(`powershell -Command "(New-Object -ComObject WScript.Shell).AppActivate('${appName}')"`);
        } else if (platform === 'linux') {
            exec(`wmctrl -a "${appName}" || code .`);
        }
    }

    private generatePrompt(payload: any, config: vscode.WorkspaceConfiguration, appName: string): string {
        const { file, line, component, element, text, route, snippet, props } = payload;
        const customTemplate = config.get<string>('customTemplate', '');

        if (customTemplate) {
            return this.fillTemplate(customTemplate, payload, config);
        }

        const systemPrompt = config.get<string>('systemPrompt', `You are editing a project in ${appName}.`);
        const taskPlaceholder = config.get<string>('taskPlaceholder', '[User instruction here]');
        const compact = config.get<boolean>('compactPrompt', false);
        const includeProps = config.get<boolean>('includeProps', true);
        const includeConstraints = config.get<boolean>('includeConstraints', true);

        const separator = compact ? ' | ' : '\n- ';
        let context = `Context:${compact ? '' : '\n- '}Route: "${route || '/'}"${separator}Component: "${component || 'unknown'}"${separator}Tag: <${element}>${separator}Text: "${text || ''}"`;

        if (file && line) {
            context += `${separator}File: "${file}"${separator}Line: ${line}`;
        }

        let propsSection = '';
        if (includeProps && props) {
            propsSection = `\n\nDetected Props:\n\`\`\`json\n${JSON.stringify(props, null, 2)}\n\`\`\``;
        }

        let snippetSection = '';
        if (snippet) {
            snippetSection = `\n\nSurrounding Code:\n\`\`\`tsx\n${snippet}\n\`\`\``;
        }

        const constraints = includeConstraints ? `\n\nConstraints:\n- Only modify code relevant to this element\n- Do not refactor unrelated components\n- Preserve existing styling patterns` : '';

        if (compact) {
            return `${systemPrompt}\n\n${context}${propsSection}${snippetSection}\n\nTask: ${taskPlaceholder}${constraints}`;
        }

        return `${systemPrompt}\n\nTarget element:\n${context}${propsSection}${snippetSection}\n\nTask:\n${taskPlaceholder}${constraints}`;
    }

    private fillTemplate(template: string, payload: any, config: vscode.WorkspaceConfiguration): string {
        const { file, line, component, element, text, route, snippet, props } = payload;
        let p = template;
        p = p.replace(/{{component}}/g, component || 'unknown');
        p = p.replace(/{{file}}/g, file || 'unknown');
        p = p.replace(/{{line}}/g, String(line || 'unknown'));
        p = p.replace(/{{tag}}/g, element || 'unknown');
        p = p.replace(/{{text}}/g, text || '');
        p = p.replace(/{{route}}/g, route || '/');
        p = p.replace(/{{snippet}}/g, snippet || '');
        p = p.replace(/{{props}}/g, props ? JSON.stringify(props, null, 2) : '');
        return p;
    }
}
