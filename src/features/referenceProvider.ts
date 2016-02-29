import * as vscode from 'vscode';
import AbstractProvider from './abstractProvider';

export default class GlobalReferenceProvider extends AbstractProvider implements vscode.ReferenceProvider {
    public provideReferences(document: vscode.TextDocument, position: vscode.Position, options: { includeDeclaration: boolean;}, token: vscode.CancellationToken): Thenable<vscode.Location[]> {
        console.log("ReferenceProvider: ");
        return vscode.workspace.saveAll(false).then(() => {
            return this.doFindReferences(document, position, options, token);
        });
    }

    private doFindReferences(document: vscode.TextDocument, position: vscode.Position, options: {includeDeclaration: boolean}, token: vscode.CancellationToken): Thenable<vscode.Location[]>{
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
            let d = self._global.queryref(textAtPosition);
            let wordLength = textAtPosition.length;
            let results: vscode.Location[] = [];

            if (d) {
                let bucket = new Array<any>();
                for (let index = 0; index < d.length; index++) {
                    let element = d[index];
                    let result = {"path": self.canonicalizeForWindows(element.filename), 
                        "line": element.line,
                        "description": element.name,
                        "label": element.filename
                    };
                    let colStr = 7;
                    let referenceResource = vscode.Uri.file(result.path);
                    let range = new vscode.Range(
                                    result.line + 1, +colStr, result.line , +colStr + wordLength - 1
                                );
                        results.push(new vscode.Location(referenceResource, range));

                }
            }
            resolve(results);
        });
    }
    private canonicalizeForWindows(filename: string): string {
            return filename;
        }
}