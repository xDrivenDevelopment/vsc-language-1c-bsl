import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";


export default class GlobalCompletionItemProvider extends AbstractProvider implements vscode.CompletionItemProvider {
    added: Object;
    private getRegExp(word: string): RegExp {
        let wordMatch = new RegExp(".*", "i");
        if (word.length > 0) {
            wordMatch = new RegExp(word, "i");
        }
        return wordMatch;
    }

    private getAllWords(word: string, source: string, completions: vscode.CompletionItem[]): vscode.CompletionItem[] {
        let wordMatch = this.getRegExp(word);
        for (let S = source.split(/[^а-яёА-ЯЁ_a-zA-Z]+/), _ = 0; _ < S.length; _++) {
        let sourceWord: string = S[_].trim();
        if (!this.added[sourceWord.toLowerCase()] && sourceWord.length > 5 && wordMatch.exec(sourceWord) != null) {
            if (sourceWord === word) {
                continue;
            }
            this.added[sourceWord.toLowerCase()] = true;
            let completion = new vscode.CompletionItem(sourceWord);
            completion.kind = vscode.CompletionItemKind.Text;
            completions.push(completion);
        }
        }
        return completions;
    }

    private getGlobals(word: string): vscode.CompletionItem[] {
        let completions: Array<vscode.CompletionItem> = new Array<vscode.CompletionItem>();
        let wordMatch = this.getRegExp(word);
        let completionDict = this._global.globalfunctions;
        for (let name in completionDict) {
            if (wordMatch.exec(name) !== null) {
                let full = completionDict[name];
                let completion = new vscode.CompletionItem(name);
                completion.kind = vscode.CompletionItemKind.Function;
                if (full["description"]) {
                    completion.documentation = full["description"];
                }
                if (full["signature"]) {
                    completion.detail = full["signature"];
                }
                completions.push(completion);
                this.added[name.toLowerCase()] = true;
            }
        }
        completionDict = this._global.globalvariables;
        for (let name in completionDict) {
            if (wordMatch.exec(name) !== null) {
                let full = completionDict[name];
                let completion = new vscode.CompletionItem(name);
                completion.kind = vscode.CompletionItemKind.Variable;
                if (full["description"]) {
                    completion.documentation = full["description"];
                }
                if (full["signature"]) {
                    completion.detail = full["signature"];
                }
                completions.push(completion);
               this.added[name.toLowerCase()] = true;
            }
        }
        completionDict = this._global.keywords;
        for (let name in completionDict) {
            if (wordMatch.exec(name) !== null) {
                let full = completionDict[name];
                let completion = new vscode.CompletionItem(name);
                completion.kind = vscode.CompletionItemKind.Keyword;
                if (full["description"]) {
                    completion.documentation = full["description"];
                }
                if (full["signature"]) {
                    completion.detail = full["signature"];
                }
                completions.push(completion);
               this.added[name.toLowerCase()] = true;
            }
        }
        return completions;
    }

    private getDotComplection(document: vscode.TextDocument, position: vscode.Position ): vscode.CompletionItem[] {
        let result = new Array<vscode.CompletionItem>();
        if (position.character > 0) {
            let char = document.getText(new vscode.Range(
                                        new vscode.Position(position.line, position.character - 1), position));
            if (char === "." && position.character > 1) {
                let basePosition = new vscode.Position(position.line, position.character - 2);
                let wordRange = document.getWordRangeAtPosition(basePosition);
                if (wordRange) {
                    let wordAtPosition = document.getText(document.getWordRangeAtPosition(basePosition));
                    wordAtPosition = this._global.fullNameRecursor(wordAtPosition, document, document.getWordRangeAtPosition(basePosition), true);
                    console.log("dot for" + wordAtPosition);
                    let metadata = {};
                    let queryResult: Array<any> = this._global.querydef(document.fileName, wordAtPosition + "\\.");
                    for (let index = 0; index < queryResult.length; index++) {
                        let element = queryResult[index];
                        if (element.module) {
                            let moduleArray = element.module.split(".");
                            if ((moduleArray.length > 1) && wordAtPosition.indexOf(".") === -1) {
                                if (!metadata[moduleArray[0] + "." + moduleArray[1]] === true) {
                                    let item: vscode.CompletionItem = new vscode.CompletionItem(moduleArray[1]);
                                    item.kind = vscode.CompletionItemKind.Class;
                                    result.push(item);
                                    metadata[moduleArray[0] + "." + moduleArray[1]] = true;
                                }
                                continue;
                            } else if (moduleArray.length > 1) {
                                    let item: vscode.CompletionItem = new vscode.CompletionItem(element.name);
                                    item.kind = vscode.CompletionItemKind.Function;
                                    item.documentation = element.description;
                                    result.push(item);
                                    metadata[moduleArray[0] + "." + moduleArray[1]] = true;
                                    continue;
                            }
                        }
                }
                // Получим все общие модули, у которых не заканчивается на точку.    
                queryResult = this._global.querydef(document.fileName, wordAtPosition, false, false);
                    for (let index = 0; index < queryResult.length; index++) {
                        let element = queryResult[index];
                        let item: vscode.CompletionItem = new vscode.CompletionItem(element.name);
                        item.kind = vscode.CompletionItemKind.Function;
                        item.documentation = element.description;
                        result.push(item);
                    }
                }
            }
        }
        return result;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {

        let word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
        let self = this;
        this.added = {};

        console.log("CompletionItemProvider: " + word);
        return new Promise((resolve, reject) => {
            let bucket = new Array<vscode.CompletionItem>();
            let word = document.getText(document.getWordRangeAtPosition(position)).split(/\r?\n/)[0];
            bucket = self.getDotComplection(document, position);
            if (bucket.length > 0) {
                return resolve(bucket);
            }
            bucket = this.getGlobals(word);
            let result: Array<any> = self._global.getCacheLocal(document.fileName, word, document.getText(), false );
            result.forEach(function (value, index, array) {
                if (!self.added[value.name.toLowerCase()] === true) {
                    let item = new vscode.CompletionItem(value.name);
                    item.documentation = value.description;
                    item.kind = vscode.CompletionItemKind.Function;
                    bucket.push(item);
                    self.added[value.name.toLowerCase()] = true;
                }
            });
            result = self._global.querydef(document.fileName, word);
            result.forEach(function (value, index, array) {
                let moduleDescription = (value.module && value.module.length > 0) ? module + "." : "";
                if (self.added[(moduleDescription + value.name).toLowerCase()] !== true) {
                    let item = new vscode.CompletionItem(moduleDescription + value.name);
                    item.documentation = value.description;
                    item.kind = vscode.CompletionItemKind.File;
                    bucket.push(item);
                    self.added[(moduleDescription + value.name).toLowerCase()] = true;
                }
            });
            bucket = self.getAllWords(word, document.getText(), bucket);
            return resolve(bucket);
        });
    }
}