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
                let completion = new vscode.CompletionItem(full["name"]);
                completion.kind = vscode.CompletionItemKind.Function;
                if (full["description"]) {
                    completion.documentation = full["description"];
                }
                if (full["signature"]) {
                    let signature_default = full["signature"].default;
                    if (signature_default) {
                        completion.detail = full["signature"].default.СтрокаПараметров;
                    } else {
                        let syn = 0;
                        let detail = "";
                        for (let signature_name in full["signature"]) {
                            syn++;
                            detail = detail + (syn === 1 ? "" : ", \n") + syn + ". " + full["signature"][signature_name].СтрокаПараметров;
                        }
                        completion.detail = "" + syn + " вариант" + (syn < 5 ? "a " : "ов ") + "синтаксиса: \n" + detail;
                    }
                }
                completion.insertText = full["name"] + "(";
                completions.push(completion);
                this.added[name] = true;
            }
        }
        completionDict = this._global.globalvariables;
        for (let name in completionDict) {
            if (wordMatch.exec(name) !== null) {
                let full = completionDict[name];
                let completion = new vscode.CompletionItem(full["name"]);
                completion.kind = vscode.CompletionItemKind.Variable;
                if (full["description"]) {
                    completion.documentation = full["description"];
                }
                completions.push(completion);
               this.added[name] = true;
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
                completions.push(completion);
               this.added[name.toLowerCase()] = true;
            }
        }
        return completions;
    }

    private getDotComplection(document: vscode.TextDocument, position: vscode.Position ): vscode.CompletionItem[] {
        let result = new Array<vscode.CompletionItem>();
        let basePosition = new vscode.Position(position.line, position.character - 2);
        let wordRange = document.getWordRangeAtPosition(basePosition);
        if (wordRange) {
            let wordAtPosition = document.getText(document.getWordRangeAtPosition(basePosition));
            wordAtPosition = this._global.fullNameRecursor(wordAtPosition, document, document.getWordRangeAtPosition(basePosition), true);
            if (this._global.toreplaced[wordAtPosition.split(".")[0]] !== undefined) {
                let arrayName = wordAtPosition.split(".");
                arrayName.splice(0, 1, this._global.toreplaced[arrayName[0]]);
                wordAtPosition = arrayName.join(".");
            }
            let queryResult: Array<any> = this._global.querydef(wordAtPosition + "\\.");
            result = this.customDotComplection(queryResult, wordAtPosition, result);
            // Получим все общие модули, у которых не заканчивается на точку.
            queryResult = this._global.querydef(wordAtPosition, false, false);
            for (let index = 0; index < queryResult.length; index++) {
                let element = queryResult[index];
                if (!element._method.IsExport) {
                    continue;
                }
                let arrayFilename = element.filename.split("/");
                if (arrayFilename[arrayFilename.length - 4] !== "CommonModules" && !element.filename.endsWith("ManagerModule.bsl")) {
                    continue;
                }
                let item: vscode.CompletionItem = new vscode.CompletionItem(element.name);
                item.kind = vscode.CompletionItemKind.Function;
                item.documentation = element.description;
                item.insertText = element.name + "(";
                result.push(item);
            }
        }
        return result;
    }

    private customDotComplection(queryResult, wordAtPosition, result) {
        let metadata = {};
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
                } else {
                    if (!element._method.IsExport) {
                        continue;
                    }
                    let arrayFilename = element.filename.split("/");
                    if (arrayFilename[arrayFilename.length - 4] !== "CommonModules" && !element.filename.endsWith("ManagerModule.bsl")) {
                        continue;
                    }
                    let item: vscode.CompletionItem = new vscode.CompletionItem(element.name);
                    item.kind = vscode.CompletionItemKind.Function;
                    item.documentation = element.description;
                    item.insertText = element.name + "(";
                    result.push(item);
                    metadata[moduleArray[0] + (moduleArray.length > 1) ? ("." + moduleArray[1]) : ""] = true;
                    continue;
                }
            }
        }
        return result;
    }

    provideCompletionItems(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): Thenable<vscode.CompletionItem[]> {

        let self = this;
        this.added = {};

        return new Promise((resolve, reject) => {
            let bucket = new Array<vscode.CompletionItem>();
            if (position.character > 0) {
                let char = document.getText(new vscode.Range(
                                            new vscode.Position(position.line, position.character - 1), position));
                if (char === "." && position.character > 1) {
                    bucket = self.getDotComplection(document, position);
                    return resolve(bucket);
                } else if (char.match(/[/\()"':,.;<>~!@#$%^&*|+=\[\]{}`?\…-\s\n\t]/) === null) {
                    let word = document.getText(document.getWordRangeAtPosition(position));
                    word = this._global.fullNameRecursor(word, document, document.getWordRangeAtPosition(position), true);
                    let result: Array<any>;
                    if (word.indexOf(".") === -1) {
                        bucket = this.getGlobals(word);
                        result = self._global.getCacheLocal(document.fileName, word, document.getText(), false);
                        result.forEach(function (value, index, array) {
                            if (!self.added[value.name.toLowerCase()] === true) {
                                let item = new vscode.CompletionItem(value.name);
                                item.documentation = value.description;
                                item.kind = vscode.CompletionItemKind.Function;
                                item.insertText = value.name + "(";
                                bucket.push(item);
                                self.added[value.name.toLowerCase()] = true;
                            }
                        });
                        bucket = self.getAllWords(word, document.getText(), bucket);
                        result = self._global.querydef(word);
                        result.forEach(function (value, index, array) {
                            let moduleDescription = (value.module && value.module.length > 0) ? value.module + "." : "";
                            let fullName = moduleDescription + value.name;
                            let description = value.description;
                            if (moduleDescription.length > 0) {
                                fullName = value.module;
                                description = fullName;
                            }
                            if (self.added[(fullName).toLowerCase()] !== true) {
                                let item = new vscode.CompletionItem(fullName);
                                item.documentation = description;
                                item.kind = vscode.CompletionItemKind.File;
                                bucket.push(item);
                                self.added[(fullName).toLowerCase()] = true;
                            }
                        });
                    } else {
                        let arrayObjectName = word.split(".").slice(0, -1);
                        word = arrayObjectName.join(".");
                        if (this._global.toreplaced[word.split(".")[0]] !== undefined) {
                            let arrayName = word.split(".");
                            arrayName.splice(0, 1, this._global.toreplaced[arrayName[0]]);
                            word = arrayName.join(".");
                        }
                        let queryResult: Array<any> = this._global.querydef(word);
                        let arrayCompletion = new Array<vscode.CompletionItem>();
                        bucket = this.customDotComplection(queryResult, word, arrayCompletion);
                    }
                    return resolve(bucket);
                } else {
                    return resolve(bucket);
                }
            }
        });
    }
}
