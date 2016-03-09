"use strict";

import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";

import { BSL_MODE, showBslStatus, hideBslStatus } from "./bslStatus";


import ChildProcess = cp.ChildProcess;

export default class BslLintProvider {

    private commandId: string;
    private args: Array<string>;
    private linterEnabled: boolean;
    private lintBSLFiles: boolean;
    private command: vscode.Disposable;
    private diagnosticCollection: vscode.DiagnosticCollection;
    private statusBarItem: vscode.StatusBarItem;

    private getCommandId(): string {
        let command = "";
        let commandConfig = vscode.workspace.getConfiguration("language-1c-bsl").get("onescriptPath");
        if (!commandConfig || String(commandConfig).length === 0) {
            command = "oscript";
        } else {
            command = String(commandConfig);
        }
        return command;
    };

    public activate(subscriptions: vscode.Disposable[]) {
        this.diagnosticCollection = vscode.languages.createDiagnosticCollection();
        vscode.workspace.onDidOpenTextDocument(this.doBsllint, this, subscriptions);
        vscode.workspace.onDidCloseTextDocument((textDocument) => {
            this.diagnosticCollection.delete(textDocument.uri);
        }, null, subscriptions);
        vscode.workspace.onDidSaveTextDocument(this.doBsllint, this);
        vscode.workspace.textDocuments.forEach(this.doBsllint, this);
        if (!this.statusBarItem) {
            let self = this;
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
            this.statusBarItem.command = "bsl.lint";
            vscode.commands.registerCommand("bsl.lint", () => {
                        vscode.commands.executeCommand("workbench.action.showErrorsWarnings");
                        self.statusBarItem.hide();
            });
        }
        this.args = ["-encoding=utf-8", "-check"];
        this.commandId = this.getCommandId();
        let linterEnabled = vscode.workspace.getConfiguration("language-1c-bsl").get("enableOneScriptLinter");
        if (!linterEnabled) {
            this.linterEnabled = false;
        } else {
            this.linterEnabled = true;
        }
        this.lintBSLFiles = Boolean(vscode.workspace.getConfiguration("language-1c-bsl").get("lintBSLFiles"));
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
        let diagnostics: vscode.Diagnostic[] = [];
        if (!this.linterEnabled) {
            return;
        }
        let filename = textDocument.uri.fsPath;
        if (filename.endsWith(".bsl") && !this.lintBSLFiles) {
            return;
        }
        let args = this.args.slice();
        args.push(filename);
        let options = {
            cwd: path.dirname(filename),
            env: process.env
        };
        let result = "";
        let phpcs = cp.spawn(this.commandId, args, options);
        phpcs.stderr.on("data", function (buffer) {
            result += buffer.toString();
        });
        phpcs.stdout.on("data", function (buffer) {
            result += buffer.toString();
        });
        phpcs.on("close", () => {
            try {
                result = result.trim();
                let lines = result.split(/\r?\n/);
                let regex = /^\{Модуль\s+(.*)\s\/\s.*:\s+(\d+)\s+\/\s+(.*)\}/;
                let vscodeDiagnosticArray = new Array<vscode.Diagnostic>();
                for (let line in lines) {
                    let match = null;
                    match = lines[line].match(regex);
                    if (match !== null) {
                        let range = new vscode.Range(
                                new vscode.Position(match[2] - 1, 0),
                                new vscode.Position(+match[2] - 1, vscode.window.activeTextEditor.document.lineAt(match[2] - 1).text.length)
                                );
                        let vscodeDiagnostic = new vscode.Diagnostic(range, match[3], vscode.DiagnosticSeverity.Error);
                        vscodeDiagnosticArray.push(vscodeDiagnostic);
                    }
                }
                this.diagnosticCollection.set(textDocument.uri, vscodeDiagnosticArray);
                if (vscodeDiagnosticArray.length !== 0 ) {
                    this.statusBarItem.text = vscodeDiagnosticArray.length === 0 ? "$(check) No Error" : "$(alert) " +  vscodeDiagnosticArray.length + " Errors";
                    this.statusBarItem.show();
                } else {
                    this.statusBarItem.hide();
                };
            } catch (e) {
                console.error(e);
            }
        });

    };
}

