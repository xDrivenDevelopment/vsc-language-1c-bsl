import * as vscode from "vscode";

export function postMessage(description: string, interval?: number) {
    if (interval) {
        vscode.window.setStatusBarMessage(description, interval);   
    } else {
        vscode.window.setStatusBarMessage(description);
    }

}

export function getConfiguration(section:string) {
    return vscode.workspace.getConfiguration(section);
}

export function getConfigurationKey(configuration:vscode.WorkspaceConfiguration, key: string) {
    return configuration.get(key);
}

export function getRootPath() {
    return vscode.workspace.rootPath;
}

export function fullNameRecursor(word: string, document: vscode.TextDocument, range: vscode.Range, left: boolean) {
        let result: string;
        let plus: number = 1;
        let newRange: vscode.Range;
        if (left) {
            plus = -1;
            if (range.start.character === 0) {
                return word;
            }
            newRange = new vscode.Range(new vscode.Position(range.start.line, range.end.character - word.length + plus), new vscode.Position(range.start.line, range.start.character));
        } else {
            newRange = new vscode.Range(new vscode.Position(range.end.line, range.end.character), new vscode.Position(range.end.line, range.end.character + plus));
        }
        let dot = document.getText(newRange);
        if (dot.endsWith(".")) {
            let newPosition: vscode.Position;
            if (left) {
                let leftWordRange: vscode.Range = document.getWordRangeAtPosition(newRange.start);
                if (leftWordRange !== undefined) {
                    result = document.getText(leftWordRange) + "." + word;
                    if (leftWordRange !== undefined && leftWordRange.start.character > 1) {
                        newPosition = new vscode.Position(leftWordRange.start.line, leftWordRange.start.character - 1);
                    } else {
                        newPosition = new vscode.Position(leftWordRange.start.line, 0);
                    }
                }
            } else {
                result = word + "." + document.getText(document.getWordRangeAtPosition(newRange.start));
                newPosition = new vscode.Position(newRange.end.line, newRange.end.character + 2);
            }
            if (document.getText(new vscode.Range(new vscode.Position(newPosition.line, newPosition.character + 1), newPosition)) === ".") {
                let newWord = document.getWordRangeAtPosition(newPosition);
                return document.getText(newWord) + "." + result;
            }
            return result;
        } else {
            result = word;
            return result;
        }
    }

export function findFilesForCache(searchPattern: string, rootPath: string) {
    let files = vscode.workspace.findFiles(searchPattern, "");
    files.then((value) => {
        this.addtocachefiles(value, rootPath);
    }, (reason) => {
        console.log(reason);
    });
}