"use strict";

import * as vscode from "vscode";
let statusBarEntry: vscode.StatusBarItem;


export const BSL_MODE: vscode.DocumentFilter = { language: "bsl", scheme: "file" };

export function showHideStatus() {
    if (!statusBarEntry) {
        return;
    }
    if (!vscode.window.activeTextEditor) {
        statusBarEntry.hide();
        return;
    }
    if (vscode.languages.match(BSL_MODE, vscode.window.activeTextEditor.document)) {
        statusBarEntry.show();
        return;
    }
    statusBarEntry.hide();
}

export function hideBslStatus() {
    statusBarEntry.hide();
}

export function showBslStatus(message: string, command: string, tooltip?: string) {
    statusBarEntry = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, Number.MIN_VALUE);
    statusBarEntry.text = message;
    statusBarEntry.command = command;
    statusBarEntry.color = "yellow";
    statusBarEntry.tooltip = tooltip;
    statusBarEntry.show();
}

