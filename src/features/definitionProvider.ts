import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";
let path = require("path");
let _ = require("underscore");

export default class GlobalDefinitionProvider extends AbstractProvider implements vscode.DefinitionProvider {
    public provideDefinition(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.Location> {
        let word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
        let self = this;
        console.log("DefinitionProvider: " + word);
        return new Promise((resolve, reject) => {
            let added = {};
            let filename = document.fileName;
            let wordAtPosition = document.getText(document.getWordRangeAtPosition(position));
            wordAtPosition = self._global.fullNameRecursor(wordAtPosition, document, document.getWordRangeAtPosition(position), false);
            wordAtPosition = self._global.fullNameRecursor(wordAtPosition, document, document.getWordRangeAtPosition(position), true);
            console.log("DefinitionProvider for:" + wordAtPosition);
            // let offset = byteOffsetAt(document, position);
            let query = {
                "filename": filename,
                "word": wordAtPosition
            }
            let module = "";
            if (wordAtPosition.indexOf(".") > 0) {
                let dotArray: Array<string> = wordAtPosition.split(".");
                wordAtPosition = dotArray.pop();
                module = dotArray.join(".");
            }
            let d: Array<any> = self._global.query(filename, wordAtPosition, module, false, false);
            let source = document.getText();
            let local = self._global.getCacheLocal(filename, wordAtPosition, source);
            if (!d) {
                d = local;
            } else {
                for (var index = 0; index < local.length; index++) {
                    var element = local[index];
                    element["filename"] = document.fileName;
                    d.push(element);
                }
            }
            _.unique(d);
            if (d.length === 0){
                d = self._global.query(filename, word, "", false, false);
            }
            if (d){
                let bucket = new Array<any>();
                for (let index = 0; index < d.length; index++) {
                    let element = d[index];
                    if (added[element.name] === true){
                        continue;
                    }
                    added[element.name] = true;
                    let moduleDescription = (module && module.length > 0) ? module + "." : "";
                    //let label = 
                    let result = {
                        "path": self.canonicalizeForWindows(element.filename),
                        "line": element.line,
                        "description": element.description,
                        "label": moduleDescription + element.name
                    };
                    bucket.push(result);
                }
                if (bucket.length === 1) {
                    var location: vscode.Location = new vscode.Location(vscode.Uri.file(bucket[0].path),
                        new vscode.Position(bucket[0].line, 3));
                    return resolve(location);
                } else if (bucket.length === 0) {
                    return resolve(null);
                }
                return vscode.window.showQuickPick(bucket).then(value => {
                    console.log(value);
                    try {
                        if (value) {
                            let referenceResource = vscode.Uri.file(value.path);
                            let location = new vscode.Location(referenceResource, new vscode.Position(value.line, 0));
                            return resolve(location);
                        } else {
                            return reject("value not found " + value);
                        }
                    } catch (e) {
                        console.error(e);
                        return reject(e);
                    }
                }
                );
            } else {
                Promise.resolve(null);
            }
        }
        )
    }
    private canonicalizeForWindows(filename: string): string {
		// convert backslashes to forward slashes on Windows
		// otherwise go-find-references returns no matches
		//if (/^[a-z]:\\/.test(filename))
            return filename;
			//return filename.replace(/\//g, '\\');
            //return filename.replace(/\\/g, '/');
            
		//return filename;
	}
}