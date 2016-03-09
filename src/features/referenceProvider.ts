import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class GlobalReferenceProvider extends AbstractProvider implements vscode.ReferenceProvider {
    public provideReferences(document: vscode.TextDocument, position: vscode.Position, options: { includeDeclaration: boolean; }, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        console.log("ReferenceProvider: ");
        return vscode.workspace.saveAll(false).then(() => {
            return this.doFindReferences(document, position, options, token);
        });
    }

    private doFindReferences(document: vscode.TextDocument, position: vscode.Position, options: {includeDeclaration: boolean}, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        let self = this;
        return new Promise((resolve, reject) => {
            let filename = document.fileName;
            let workspaceRoot = vscode.workspace.rootPath;
            // get current word
            let wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange) {
                return resolve([]);
            }
            let textAtPosition = document.getText(wordRange);
            let wordLength = textAtPosition.length;
            let results: vscode.Location[] = Array<vscode.Location>();

            let source = document.getText();
            let lines = (source.indexOf("\r\n") === -1) ? source.split("\n") : source.split("\r\n");
            let curModule: Array<any> = self._global.getCacheLocal(document.fileName, ".*", source, true);
            let wordReg = new RegExp("^" + textAtPosition + "$", "i");
            let wordAllReg = new RegExp(textAtPosition + "\\(", "i");
            if (curModule.length > 0) {
                for (let index = 0; index < curModule.length; index++) {
                    let element = curModule[index];
                    for (let index = 0; index < element._method.Calls.length; index++) {
                        let callElement = element._method.Calls[index];
                        if (wordReg.exec(callElement) !== null) {
                            let referenceResource = vscode.Uri.file(document.fileName);
                            let line = element.line;
                            let colStr = 0;
                            let foundInProc = false;
                            for (let indexLine = line; indexLine <= element._method.EndLine; indexLine++) {
                                let curLine = lines[indexLine];
                                if (wordAllReg.exec(curLine) !== null) {
                                    foundInProc = true;
                                    let match = wordAllReg.exec(curLine);
                                    line = indexLine;
                                    colStr = wordAllReg.exec(curLine).index + 1;
                                    let range = new vscode.Range(
                                            line, +colStr, line , +colStr + wordLength - 1);
                                    results.push(new vscode.Location(referenceResource, range));
                                }
                            };
                            if (foundInProc === false) {
                                let range = new vscode.Range(
                                            line, +colStr, line , +colStr + wordLength - 1
                                        );
                                results.push(new vscode.Location(referenceResource, range));
                            }
                        }
                    }
                }
                if (results.length > 0) {
                    return resolve(results);
                }
            }
            let d = self._global.queryref(textAtPosition);
            // Определим это экспортная процедура или нет, если экспортная, тогда ищем глобально. 
            // Если не экспортная, тогда ищем только в текущем модуле. 

            if (d) {
                let bucket = new Array<any>();
                for (let index = 0; index < d.length; index++) {
                    let element = d[index];
                    let result = {"path": element.filename,
                        "line": element.line,
                        "description": element.name,
                        "label": element.filename
                    };
                    let colStr = element.character;
                    let referenceResource = vscode.Uri.file(result.path);
                    let range = new vscode.Range(
                                    result.line, +colStr, result.line , +colStr + wordLength - 1
                                );
                        results.push(new vscode.Location(referenceResource, range));

                }
            }
            resolve(results);
        });
    }
}