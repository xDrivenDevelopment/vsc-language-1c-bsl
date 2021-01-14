"use strict";

import * as cp from "child_process";
import * as path from "path";
import * as vscode from "vscode";

import { BSL_MODE } from "../const";

export default class LintProvider {
    private commandId: string = this.getCommandId();
    private args: string[] = ["-encoding=utf-8", "-check"];
    private diagnosticCollection: vscode.DiagnosticCollection = vscode.languages.createDiagnosticCollection(
        "OneScript Linter"
    );
    private statusBarItem: vscode.StatusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Left
    );

    public activate(subscriptions: vscode.Disposable[]) {
        vscode.workspace.onDidOpenTextDocument(this.doBsllint, this, subscriptions);
        vscode.workspace.onDidCloseTextDocument(this.doBsllint, this, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this.doBsllint, this);
        vscode.workspace.textDocuments.forEach(this.doBsllint, this);
    }

    public dispose(): void {
        this.diagnosticCollection.clear();
        this.diagnosticCollection.dispose();
        this.statusBarItem.hide();
    }

    public doBsllint(textDocument: vscode.TextDocument) {
        if (!vscode.languages.match(BSL_MODE, textDocument)) {
            return;
        }
        this.diagnosticCollection.clear();
        const configuration = vscode.workspace.getConfiguration("language-1c-bsl");
        const linterEnabled = Boolean(configuration.get("enableOneScriptLinter"));
        const otherExtensions = String(configuration.get("lintOtherExtensions"));
        const linterEntryPoint = String(configuration.get("linterEntryPoint"));
        if (!linterEnabled) {
            return;
        }
        const filename = textDocument.uri.fsPath;
        const arrFilename = filename.split(".");
        if (arrFilename.length === 0) {
            return;
        }
        const extension = arrFilename[arrFilename.length - 1].toLowerCase();
        if (extension !== "os" && !otherExtensions.includes(extension)) {
            return;
        }
        const args = this.args.slice();
        args.push(filename);
        if (linterEntryPoint) {
            args.push(
                "-env=" +
                    path.join(
                        vscode.workspace.getWorkspaceFolder(
                            vscode.window.activeTextEditor.document.uri
                        ).uri.fsPath,
                        linterEntryPoint
                    )
            );
        }
        const options = {
            cwd: path.dirname(filename),
            env: process.env
        };
        let result = "";

        const phpcs = cp.spawn(this.commandId, args, options);
        phpcs.stderr.on("data", buffer => {
            result += buffer.toString();
        });
        phpcs.stdout.on("data", buffer => {
            result += buffer.toString();
        });
        phpcs.on("close", () => {
            try {
                result = result.trim();
                const lines = result.split(/\r?\n/);
                const regex = /^\{Модуль\s+(.*)\s\/\s.*:\s+(\d+)(?:,(\d)+)?\s+\/\s+(.*)\}/;
                const errorFiles = {};
                let countErrors = 0;
                for (const line of lines) {
                    let match;
                    match = line.match(regex);
                    if (match) {
                        const fileName = match[1];

                        let startLine = +match[2] - 1;
                        if (startLine < 0) {
                            startLine = 0;
                        }

                        let startCharacter = +match[3] - 1;
                        if (startCharacter < 0) {
                            startCharacter = 0;
                        }

                        if (startLine > vscode.window.activeTextEditor.document.lineCount) {
                            startLine = vscode.window.activeTextEditor.document.lineCount - 1;
                            startCharacter = 0;
                        }

                        const errorMessage = match[4];
                        const range = new vscode.Range(
                            new vscode.Position(startLine, startCharacter),
                            new vscode.Position(
                                startLine,
                                vscode.window.activeTextEditor.document.lineAt(
                                    startLine
                                ).text.length
                            )
                        );
                        const vscodeDiagnostic = new vscode.Diagnostic(
                            range,
                            errorMessage,
                            vscode.DiagnosticSeverity.Error
                        );
                        vscodeDiagnostic.code = "oscript-check";
                        if (!errorFiles[fileName]) {
                            errorFiles[fileName] = new Array<vscode.Diagnostic>();
                        }
                        errorFiles[fileName].push(vscodeDiagnostic);
                        countErrors++;
                    }
                }
                for (const file in errorFiles) {
                    const vscodeDiagnosticArray = errorFiles[file];
                    this.diagnosticCollection.set(vscode.Uri.file(file), vscodeDiagnosticArray);
                }
                if (countErrors !== 0 && !vscode.workspace.workspaceFolders) {
                    this.statusBarItem.text = `$(alert) ${countErrors} Errors`;
                    this.statusBarItem.show();
                } else {
                    this.statusBarItem.hide();
                }
            } catch (e) {
                console.error(e);
            }
        });
    }

    public async getDiagnosticData(uri: vscode.Uri) {
        while (this.diagnosticCollection.get(uri) === undefined) {
            await this.delay(100);
        }
        return this.diagnosticCollection.get(uri);
    }

    private delay(milliseconds: number) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    private getCommandId(): string {
        const commandConfig = vscode.workspace
            .getConfiguration("language-1c-bsl")
            .get("onescriptPath");
        const command =
            !commandConfig || String(commandConfig).length === 0
                ? "oscript"
                : String(commandConfig);
        return command;
    }
}
