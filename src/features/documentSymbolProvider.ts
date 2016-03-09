import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class GlobalDocumentSymbolProvider extends AbstractProvider implements vscode.DocumentSymbolProvider {
    public provideDocumentSymbols(document: vscode.TextDocument, token: vscode.CancellationToken): Thenable<vscode.SymbolInformation[]> {
        let self = this;
        return new Promise((resolve, reject) => {
            let bucket: vscode.SymbolInformation[] = new Array<vscode.SymbolInformation>();
            // 1. Получаем все автодополнения для текущего файла. 
            let source = document.getText();
            try {
                let result: Array<any> = this._global.getCacheLocal(document.fileName, "", source, true);
                result.forEach(function(value, index, array){
                    bucket.push(new vscode.SymbolInformation(value.name, vscode.SymbolKind.Function,
                        new vscode.Range(new vscode.Position(value.line, 0), new vscode.Position(value.line, 0))
                        ));
                });
            } catch (e) {
                console.error(e);
            }
            return resolve(bucket);
        });
    }
}