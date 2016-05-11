import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class GlobalReferenceProvider extends AbstractProvider implements vscode.ReferenceProvider {
    public provideReferences(document: vscode.TextDocument, position: vscode.Position, options: { includeDeclaration: boolean; }, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        return this.doFindReferences(document, position, options, token);
    }

    private addReference(searchResult: any, results: vscode.Location[]): any {
        if (searchResult) {
            let bucket = new Array<any>();
            for (let index = 0; index < searchResult.length; index++) {
                let element = searchResult[index];
                let result = {
                    "path": element.filename,
                    "line": element.line,
                    "description": element.name,
                    "label": element.filename
                };
                let colStr = element.character;
                let referenceResource = vscode.Uri.file(result.path);
                let range = new vscode.Range(
                    result.line, +colStr, result.line, +colStr + element.call.length
                );
                results.push(new vscode.Location(referenceResource, range));

            }
        }
    }

    private doFindReferences(document: vscode.TextDocument, position: vscode.Position, options: { includeDeclaration: boolean }, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        return new Promise((resolve, reject) => {
            let filename = document.fileName;
            let workspaceRoot = vscode.workspace.rootPath;
            // get current word
            let wordRange = document.getWordRangeAtPosition(position);
            if (!wordRange) {
                return resolve([]);
            }
            let textAtPosition = document.getText(wordRange);
            let results: vscode.Location[] = Array<vscode.Location>();

            let source = document.getText();
            let lines = (source.indexOf("\r\n") === -1) ? source.split("\n") : source.split("\r\n");

            if (document.isDirty) {
                this._global.customUpdateCache(source, filename);
            }
            let localRefs = this._global.cache.getCollection(filename);
            let d = this._global.queryref(textAtPosition, localRefs, true);
            let res = this.addReference(d, results);
            if (results.length > 0) {
                // resolve(results);
            }
            if (workspaceRoot) {
                let fullmodule = this._global.getModuleForPath(filename.replace(/\\/g, "/"), vscode.workspace.rootPath);
                let localsearch = false;
                let enTextAtPosition = undefined;
                if (fullmodule.length !== 0) {
                    let arrName = filename.substr(vscode.workspace.rootPath.length).split("\\");
                    if (this._global.toreplaced[arrName[arrName.length - 4]] !== undefined) {
                        enTextAtPosition = arrName[arrName.length - 4] + "." + arrName[arrName.length - 3] + "." + textAtPosition;
                    }
                    textAtPosition = fullmodule + "." + textAtPosition;
                    localsearch = true;
                }
                d = this._global.dbcalls.get(textAtPosition);
                if (enTextAtPosition) {
                    let en_d = this._global.dbcalls.get(enTextAtPosition);
                    if (en_d !== undefined && d === undefined) {
                        d = en_d;
                    } else if (en_d !== undefined && d !== undefined) {
                        d = d.concat(en_d);
                    }
                }
                res = this.addReference(d, results);
            }
            return resolve(results);
        });
    }
}