import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class GlobalDefinitionProvider extends AbstractProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
        let word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
        this._global.hoverTrue = false;
        return new Promise((resolve, reject) => {
            let added = {};
            let filename = document.fileName;
            let wordPosition = document.getWordRangeAtPosition(position);
            let wordAtPosition = document.getText(wordPosition);
            if (!wordPosition) {
                wordAtPosition = "";
            } else {
                wordAtPosition = this._global.fullNameRecursor(wordAtPosition, document, wordPosition, true);
                if (this._global.toreplaced[wordAtPosition.split(".")[0]] !== undefined) {
                    let arrayName = wordAtPosition.split(".");
                    arrayName.splice(0, 1, this._global.toreplaced[arrayName[0]]);
                    wordAtPosition = arrayName.join(".");
                }
            }
            if (this._global.globalfunctions[wordAtPosition.toLowerCase()]) {
                return null;
            }
            let module = "";
            if (wordAtPosition.indexOf(".") > 0) {
                // if (path.extname(document.fileName) !== ".os") { // Для oscript не можем гаранитировать полное совпадение модулей.  
                let dotArray: Array<string> = wordAtPosition.split(".");
                wordAtPosition = dotArray.pop();
                module = dotArray.join(".");
                // }
            }
            let local: Array<any>;
            let d: Array<any> = new Array();
            if (module.length === 0) {
                let source = document.getText();
                d = this._global.getCacheLocal(filename, wordAtPosition, source, false, false);
            } else {
                d = this._global.query(wordAtPosition, module, false, false);
                if (d.length > 1) {
                    for (let k = 0; k < d.length; k++) {
                        let arrayFilename = d[k].filename.split("/");
                        if (arrayFilename[arrayFilename.length - 4] === "CommonModules" || d[k].filename.endsWith("ManagerModule.bsl")) {
                            d = [d[k]];
                            break;
                        }
                    }
                }
            }
            if (d.length === 0) {
                d = this._global.query(word, "", false, false);
            }
            if (d) {
                let bucket = new Array<any>();
                for (let index = 0; index < d.length; index++) {
                    let element = d[index];
                    if (module.length !== 0 && element._method.IsExport === false) {
                        continue;
                    }
                    // if (added[element.name] === true) {
                    //     continue;
                    // }
                    added[element.name] = true;
                    let moduleDescription = (module && module.length > 0) ? module + "." : "";
                    let result = {
                        "path": element.filename,
                        "line": element.line,
                        "description": element.description,
                        "label": moduleDescription + element.name,
                        "isproc": element.isproc
                    };
                    if (!result.path) {
                        result.path = filename;
                    }
                    bucket.push(result);
                }
                if (bucket.length === 1) {
                    let location: vscode.Location = new vscode.Location(vscode.Uri.file(bucket[0].path),
                        new vscode.Position(bucket[0].line, (bucket[0].isproc ? 9 : 7) + 1));
                    return resolve(location);
                } else if (bucket.length === 0) {
                    return resolve(null);
                } else if (bucket.length > 1) {
                    let results: vscode.Location[] = Array<vscode.Location>();
                    for (let index = 0; index < bucket.length; index++) {
                        let element = bucket[index];
                        let location: vscode.Location = new vscode.Location(vscode.Uri.file(bucket[index].path),
                            new vscode.Position(bucket[index].line, (bucket[index].isproc ? 9 : 7) + 1));
                        results.push(location);
                    }
                    return resolve(results);
                }
                return vscode.window.showQuickPick(bucket).then(value => {
                    try {
                        if (value) {
                            let referenceResource = vscode.Uri.file(value.path);
                            let location = new vscode.Location(referenceResource, new vscode.Position(value.line, (value.isproc ? 9 : 7) + 1));
                            return resolve(location);
                        } else {
                            return reject("value not found " + value);
                        }
                    } catch (e) {
                        console.error(e);
                        return reject(e);
                    }
                });
            } else {
                Promise.resolve(null);
            }
        });
    }
}