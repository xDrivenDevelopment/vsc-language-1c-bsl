import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";

export default class TextDocumentContentProvider extends AbstractProvider implements vscode.TextDocumentContentProvider {
    private _onDidChange = new vscode.EventEmitter<vscode.Uri>();
    get onDidChange(): vscode.Event<vscode.Uri> {
        return this._onDidChange.event;
    }
    public provideTextDocumentContent(uri: vscode.Uri): string {
        let editor = vscode.window.activeTextEditor;
        if (!(editor.document.languageId === "bsl")) {
            return;
        }
        if (!this._global.methodForDescription) {
            return;
        }
        let word = "";
        word = this._global.methodForDescription.label;
        let description = this._global.methodForDescription.description + "<br/>";
        let entry = this._global.globalfunctions[this._global.methodForDescription.label.toLowerCase()];
        for (let element in entry.signature) {
            let re = new RegExp("\\(.*\\):\\s*.*", "g");
            let retValue = re.exec(entry.signature[element].СтрокаПараметров) ? "Функция " : "Процедура ";
            description = description + "<p><span class='storage'>" + retValue + "</span><span class='function_name'>" + entry.name + "</span><span class='parameter_variable'>" + entry.signature[element]["СтрокаПараметров"] + "</span></p>";
            let header = false;
            for (let param in entry.signature[element].Параметры) {
                if (header === false) {
                    description = description + "<h3>Параметры:</h3>";
                    header = true;
                }
                description = description + "<b><em>" + param + ":</em></b> " + entry.signature[element].Параметры[param] + "<br/>";
            }
        }
        this._global.methodForDescription = undefined;
        return `<style>
                        .monaco-shell .storage {
                            color:#0000FF
                        }
                        .monaco-shell .function_name {
                            color:#795E26
                        }
                        .monaco-shell .parameter_variable {
                            color:#001080
                        }
                        .storage {
                            color:#569CD6
                        }
                        .function_name {
                            color:#DCDCAA
                        }
                        .parameter_variable {
                            color:#9CDCFE
                        }
                    </style>
                    <body>
                    <script>
                    (function() {
                        try {
                            var theme = window.localStorage.getItem('storage://this._global/workbench.theme');
                            if (theme && theme.indexOf('vs-dark') < 0) {
                                window.document.body.className = 'monaco-shell'; // remove the dark theme class if we are on a light theme
                            }
                        } catch (error) {
                            console.error(error);
                        }
                    })();
                    </script>
                    <h1 style = "font-size: 1.2em;">${word}</h1>
                    <hr>
                    <div id="el">${description}</div>
                </body>`;
    }


    public update(uri: vscode.Uri) {
        this._onDidChange.fire(uri);
    }
}