"use strict";

import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";
import {BSL_MODE} from "../const";

export default class GlobalworkspaseSymbolProvider extends AbstractProvider implements vscode.WorkspaceSymbolProvider {
    public provideWorkspaceSymbols(search: string, token: vscode.CancellationToken): Promise<vscode.SymbolInformation[]> {
        let document = vscode.window.activeTextEditor.document;
        if (vscode.window.activeTextEditor && vscode.languages.match(BSL_MODE, document) && document.isDirty) {
            this._global.customUpdateCache(document.getText(), document.fileName);
        }
        let d: Array<any> = this._global.query(search, "", true, true);
        let bucket = new Array<vscode.SymbolInformation>();
        let arrayLength = Math.min(d.length, 1000);
        for (let index = 0; index < arrayLength; index++) {
            let element = d[index];
            let range = new vscode.Range(new vscode.Position(element.line, 0), new vscode.Position(element.line, 0));
            let result = new vscode.SymbolInformation(element.name, vscode.SymbolKind.Function,
                range, vscode.Uri.file(element.filename));
            bucket.push(result);
        }
        return Promise.resolve(bucket);
    }
}