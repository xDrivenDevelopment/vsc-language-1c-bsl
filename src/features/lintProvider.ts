"use strict";

import * as vscode from "vscode";
import * as path from "path";
import * as cp from "child_process";

import { BSL_MODE } from "../const";


import ChildProcess = cp.ChildProcess;

export default class LintProvider {

    private commandId: string;
    private args: Array<string>;
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
        if (!this.statusBarItem) {
            this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        }
        this.args = ["-encoding=utf-8", "-check"];
        this.commandId = this.getCommandId();
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
        let configuration = vscode.workspace.getConfiguration("language-1c-bsl");
        let linterEnabled = Boolean(configuration.get("enableOneScriptLinter"));
        let otherExtensions = String(configuration.get("lintOtherExtensions"));
        let linterEntryPoint = String(configuration.get("linterEntryPoint"));
        let diagnostics: vscode.Diagnostic[] = [];
        if (!linterEnabled) {
            return;
        }
        let filename = textDocument.uri.fsPath;
        let arrFilename = filename.split(".");
        if (arrFilename.length == 0) {
            return;
        }
        let extension = arrFilename[arrFilename.length - 1];
        if (extension != "os" && !otherExtensions.includes(extension)) {
            return;
        }
        let args = this.args.slice();
        args.push(filename);
        if (linterEntryPoint) {
            args.push("-env=" + vscode.workspace.rootPath + path.sep + linterEntryPoint);
        }
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
                                new vscode.Position(+match[2] - 1, 0),
                                new vscode.Position(+match[2] - 1, vscode.window.activeTextEditor.document.lineAt(+match[2] - 1).text.length)
                                );
                        let vscodeDiagnostic = new vscode.Diagnostic(range, match[3], vscode.DiagnosticSeverity.Error);
                        vscodeDiagnosticArray.push(vscodeDiagnostic);
                    }
                }
                this.diagnosticCollection.set(textDocument.uri, vscodeDiagnosticArray);
                if (vscodeDiagnosticArray.length !== 0 && vscode.workspace.rootPath === undefined) {
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

