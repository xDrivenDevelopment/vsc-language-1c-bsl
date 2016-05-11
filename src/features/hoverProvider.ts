import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class GlobalHoverProvider extends AbstractProvider implements vscode.HoverProvider {
    public provideHover(document: vscode.TextDocument, position: vscode.Position, token: vscode.CancellationToken): vscode.Hover {
        if (!this._global.hoverTrue) {
            this._global.hoverTrue = true;
            return null;
        }
        let wordRange = document.getWordRangeAtPosition(position);
        let word = document.getText(wordRange);
        if (word.split(" ").length > 1) {
            return null;
        }
        if (document.getText(new vscode.Range(wordRange.end, new vscode.Position(wordRange.end.line, wordRange.end.character + 1))) !== "(") {
            return null;
        }
        word = this._global.fullNameRecursor(word, document, wordRange, true);
        let entry = this._global.globalfunctions[word.toLowerCase()];
        if (!entry || !entry.description) {
            let module = "";
            if (word.indexOf(".") > 0) {
                let dotArray: Array<string> = word.split(".");
                word = dotArray.pop();
                if (this._global.toreplaced[dotArray[0]] !== undefined) {
                    dotArray[0] = this._global.toreplaced[dotArray[0]];
                }
                module = dotArray.join(".");
            }
            if (module.length === 0) {
                let source = document.getText();
                entry = this._global.getCacheLocal(document.fileName, word, source, false, false);
            } else {
                entry = this._global.query(word, module, false, false);
            }
            // Показ ховера по имени функции
            // if (entry.length === 0) {
            //     entry = this._global.query(word, "", false, false);
            // }
            if (!entry) {
                return null;
            } else if (module.length === 0) {
               entry = entry[0];
               return this.GetHover(entry, "Метод текущего модуля");
           } else {
               for (let i = 0; i < entry.length; i++) {
                   let hoverElement = entry[i];
                   let arrayFilename = hoverElement.filename.split("/");
                   if (arrayFilename[arrayFilename.length - 4] !== "CommonModules" && !hoverElement.filename.endsWith("ManagerModule.bsl")) {
                       continue;
                   }
                   if (hoverElement._method.IsExport) {
                       return this.GetHover(hoverElement, "Метод из " + hoverElement.filename);
                   }
               }
               return null;
           }
        }
        let description = [];
        description.push("Метод глобального контекста");
        description.push(entry.description);

        for (let element in entry.signature) {
            let re = new RegExp("\\(.*\\):\\s*.*", "g");
            let retValue = re.exec(entry.signature[element].СтрокаПараметров) ? "Функция " : "Процедура ";
            description.push({ language: "1C (BSL)", value: retValue + entry.name + entry.signature[element].СтрокаПараметров });
            // description.push("Параметры");
            for (let param in entry.signature[element].Параметры) {
                description.push("***" + param + "***: " + entry.signature[element].Параметры[param]);
            }
        }
        return new vscode.Hover(description);
    }

    private GetHover(entry, methodContext) {
        let description = [];
        let methodDescription = "";
        let arraySignature = this._global.GetSignature(entry);
        let re = new RegExp("(Параметры|Parameters)(.|\\s)*\\n\\s*", "g");
        let paramString = re.exec(arraySignature.description);
        if (paramString) {
            methodDescription = arraySignature.description.substr(0, paramString.index);
        } else {
            methodDescription = arraySignature.description;
        }
        methodDescription = methodDescription + (arraySignature.fullRetState ? arraySignature.fullRetState : "");
        description.push(methodContext);
        description.push(methodDescription);
        description.push({language: "1C (BSL)", value: (entry.isproc ? "Процедура " : "Функция ") + entry.name + arraySignature.paramsString + (arraySignature.strRetState ? ": " + arraySignature.strRetState : "")});
        for (let param in entry._method.Params) {
            let documentationParam = this._global.GetDocParam(arraySignature.description, entry._method.Params[param]);
            description.push("***" + entry._method.Params[param] + "***: " + documentationParam.descriptionParam);
        }
        return new vscode.Hover(description);
    }
}
