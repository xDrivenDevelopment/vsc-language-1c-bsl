import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class GlobalDefinitionProvider extends AbstractProvider
    implements vscode.DefinitionProvider {
    public provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Thenable<vscode.Location[]> {
        const word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
        this._global.hoverTrue = false;
        return new Promise(resolve => {
            const result: vscode.Location[] = [];
            const added = {};
            const wordPosition = document.getWordRangeAtPosition(position);
            let wordAtPosition = document.getText(wordPosition);
            if (!wordPosition) {
                wordAtPosition = "";
            } else {
                wordAtPosition = this._global.fullNameRecursor(
                    wordAtPosition,
                    document,
                    wordPosition,
                    true
                );
                if (this._global.toreplaced[wordAtPosition.split(".")[0]]) {
                    const arrayName = wordAtPosition.split(".");
                    arrayName.splice(0, 1, this._global.toreplaced[arrayName[0]]);
                    wordAtPosition = arrayName.join(".");
                }
            }
            let d: any[];
            if (this._global.globalfunctions[wordAtPosition.toLowerCase()]) {
                return resolve(result);
            } else if (wordPosition.start.character > 0) {
                const wordOfPosition = document.getText(
                    new vscode.Range(
                        wordPosition.start.line,
                        0,
                        wordPosition.start.line,
                        wordPosition.start.character - 1
                    )
                );
                if (wordOfPosition.trim().endsWith("Новый")) {
                    const entry = this._global.libClasses[wordAtPosition.toLowerCase()];
                    if (entry) {
                        d = this._global.querydef(word);
                        if (d) {
                            const location = new vscode.Location(
                                vscode.Uri.file(d[0].filename),
                                new vscode.Position(0, 0)
                            );
                            result.push(location);
                            return resolve(result);
                        }
                    }
                }
            }
            let module = "";
            if (wordAtPosition.indexOf(".") > 0) {
                const dotArray: string[] = wordAtPosition.split(".");
                wordAtPosition = dotArray.pop();
                module = dotArray.join(".");
            }
            if (module.length === 0) {
                const source = document.getText();
                d = this._global.getCacheLocal(wordAtPosition, source, false);
            } else {
                d = this._global.query(wordAtPosition, module, false, false);
                if (d.length > 1) {
                    for (const targetModule of d) {
                        const arrayFilename = targetModule.filename.split("/");
                        if (
                            (!targetModule.oscriptLib &&
                                arrayFilename[arrayFilename.length - 4] === "CommonModules") ||
                            targetModule.filename.endsWith("ManagerModule.bsl")
                        ) {
                            d = [targetModule];
                            break;
                        }
                    }
                }
            }
            if (d.length === 0) {
                d = this._global.query(word, "", false, false);
            }
            if (d) {
                for (const element of d) {
                    if (module.length !== 0 && element._method.IsExport === false) {
                        continue;
                    }
                    // if (added[element.name] === true) {
                    //     continue;
                    // }
                    added[element.name] = true;
                    const start = new vscode.Position(element.line, (element.isproc ? 9 : 7) + 1);
                    const end = new vscode.Position(start.line, start.character + element.name.length);
                    const location = new vscode.Location(
                        element.filename ? vscode.Uri.file(element.filename) : document.uri,
                        new vscode.Range(start, end)
                    );
                    result.push(location);
                }
            }
            return resolve(result);
        });
    }
}
