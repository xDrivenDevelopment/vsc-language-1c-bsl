// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import { BSL_MODE } from "./const";
import {Global} from "./global";
import CompletionItemProvider from "./features/completionItemProvider";
import DefinitionProvider from "./features/definitionProvider";
import LintProvider from "./features/lintProvider";
import DocumentSymbolProvider from "./features/documentSymbolProvider";
import WorkspaseSymbolProvider from "./features/workspaceSymbolProvider";
import ReferenceProvider from "./features/referenceProvider";
import SignatureHelpProvider from "./features/signatureHelpProvider";
import HoverProvider from "./features/hoverProvider";
import SyntaxHelper from "./features/syntaxHelper";
import * as vscAdapter from "./vscAdapter";

let diagnosticCollection: vscode.DiagnosticCollection;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    const global = new Global(vscAdapter);
    
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(BSL_MODE, new CompletionItemProvider(global), ".", "="));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(BSL_MODE, new DefinitionProvider(global)));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(BSL_MODE, new DocumentSymbolProvider(global)));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(BSL_MODE, new ReferenceProvider(global)));
    context.subscriptions.push(vscode.languages.registerWorkspaceSymbolProvider(new WorkspaseSymbolProvider(global)));
    context.subscriptions.push(vscode.languages.registerSignatureHelpProvider(BSL_MODE, new SignatureHelpProvider(global), "(", ","));
    context.subscriptions.push(vscode.languages.registerHoverProvider(BSL_MODE, new HoverProvider(global)));
    
    let syntaxHelper = new SyntaxHelper(global);
    context.subscriptions.push(vscode.workspace.registerTextDocumentContentProvider("syntax-helper", syntaxHelper));

    let linter = new LintProvider();
    linter.activate(context.subscriptions);

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.update", () => {
        let filename = vscode.window.activeTextEditor.document.fileName;
        global.updateCache();
    }));

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.createComments", () => {
        if (vscode.window.activeTextEditor.document.languageId === "bsl") {
            let configuration = vscode.workspace.getConfiguration("language-1c-bsl");
            let aL: any = configuration.get("languageAutocomplete");
            let editor = vscode.window.activeTextEditor;
            let positionStart = vscode.window.activeTextEditor.selection.anchor;
            let positionEnd = vscode.window.activeTextEditor.selection.active;
            let lineMethod = (positionStart.line > positionEnd.line) ? positionStart.line + 1 : positionEnd.line + 1;
            let re = /^(Процедура|Функция|procedure|function)\s*([\wа-яё]+)/im;
            for (let indexLine = lineMethod; indexLine >= 0; --indexLine) {
                let MatchMethod = re.exec(editor.document.lineAt(indexLine).text);
                if (MatchMethod === null) {
                    continue;
                }
                let isFunc = (MatchMethod[1].toLowerCase() === "function" || MatchMethod[1].toLowerCase() === "функция");
                let comment = "";
                let methodDescription = "";
                if (aL === "en") {
                    methodDescription = (isFunc) ? "Function description" : "Procedure description";
                } else {
                    methodDescription = (isFunc) ? "Описание функции" : "Описание процедуры";
                }
                comment += "// <" + methodDescription + ">\n";
                let params = global.getCacheLocal(editor.document.fileName, MatchMethod[2], editor.document.getText())[0]._method.Params;
                if (params.length > 0) {
                    comment += "//\n";
                    comment += ((aL === "en") ? "// Parameters:\n" : "// Параметры:\n");
                }
                for (let index = 0; index < params.length; index++) {
                    let element = params[index];
                    comment += "//   " + element + ((aL === "en") ? " - <Type.Subtype> - <parameter description>" : " - <Тип.Вид> - <описание параметра>");
                    comment += "\n";
                }
                if (isFunc) {
                    comment += "//\n";
                    comment += ((aL === "en") ? "//  Returns:\n" : "//  Возвращаемое значение:\n");
                    comment += ((aL === "en") ? "//   <Type.Subtype>   - <returned value description>" : "//   <Тип.Вид>   - <описание возвращаемого значения>");
                    comment += "\n";
                }
                comment += "//\n";
                editor.edit(function (editBuilder) {
                    editBuilder.replace(new vscode.Position(indexLine, 0), comment);
                });
            }
        }
    }));

    vscode.languages.setLanguageConfiguration("bsl", {
        indentationRules: {
            decreaseIndentPattern: /^\s*(конецесли|конеццикла|конецпроцедуры|конецфункции|иначе|иначеесли|конецпопытки|исключение|endif|enddo|endprocedure|endfunction|else|elseif|endtry|except).*$/i,
            increaseIndentPattern: /^\s*(пока|процедура|функция|если|иначе|иначеесли|попытка|исключение|для|while|procedure|function|if|else|elseif|try|for)[^;]*$/i
        },
        comments: {
            lineComment: "//"
        },
        __characterPairSupport: {
            autoClosingPairs: [
                { open: "{", close: "}" },
                { open: "[", close: "]" },
                { open: "(", close: ")" },
                { open: "\"", close: "\"", notIn: ["string"] },
                { open: "'", close: "'", notIn: ["string", "comment"] },
                { open: "`", close: "`", notIn: ["string", "comment"] }
            ]
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"]
        ],
        onEnterRules: [
            {
                beforeText: /^\s*\|([^\"]|"[^\"]*")*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: "|" }
            },
            {
                beforeText: /^([^\|\"]|"[^\"]*")*\"[^\"]*$/,
                action: { indentAction: vscode.IndentAction.None, appendText: "|" }
            }
        ]
    });

    vscode.languages.setLanguageConfiguration("sdbl", {

        comments: {
            lineComment: "//"
        },
        brackets: [
            ["{", "}"],
            ["[", "]"],
            ["(", ")"]
        ]
    });

    context.subscriptions.push(vscode.workspace.onDidChangeTextDocument(function (textDocumentChangeEvent: vscode.TextDocumentChangeEvent) {
        let editor = vscode.window.activeTextEditor;
        if (textDocumentChangeEvent.contentChanges[0].text.slice(-1) === "(") {
            let point = textDocumentChangeEvent.contentChanges[0].range.start.character + textDocumentChangeEvent.contentChanges[0].text.length;
            let position = new vscode.Position(editor.selection.active.line, point);
            editor.edit(function (editBuilder) {
                editBuilder.insert(new vscode.Position(position.line, position.character), ")");
            }).then(function () {
                vscode.commands.executeCommand("editor.action.triggerParameterHints");
                vscode.window.activeTextEditor.selection = new vscode.Selection(position.line, position.character, position.line, position.character);
            });
        }
    }));

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(function (textEditor: vscode.TextEditor) {
        applyConfigToTextEditor(textEditor);
        if (!global.cache.getCollection(textEditor.document.fileName)) {
            global.getRefsLocal(textEditor.document.fileName, textEditor.document.getText());
        }
        if (vscode.workspace.rootPath !== undefined) {
            for (let index = 0; index < vscode.workspace.textDocuments.length; index++) {
                let element = vscode.workspace.textDocuments[index];
                if (element.isDirty && element.languageId === "bsl") {
                    global.customUpdateCache(element.getText(), element.fileName);
                }
            }
        }
    }));

    context.subscriptions.push(vscode.workspace.onDidSaveTextDocument(function (document: vscode.TextDocument) {
        if (vscode.workspace.rootPath !== undefined) {
            global.customUpdateCache(document.getText(), document.fileName);
        }
    }));

    let previewUriString = "syntax-helper://authority/Синтакс-Помощник";
    let previewUri = vscode.Uri.parse(previewUriString);

    context.subscriptions.push(vscode.commands.registerCommand("language-1c-bsl.syntaxHelper", () => {
        if (!vscode.window.activeTextEditor) {
            return;
        }
        let word = vscode.window.activeTextEditor.document.getText(vscode.window.activeTextEditor.document.getWordRangeAtPosition(vscode.window.activeTextEditor.selection.active));
        let globalMethod =  global.globalfunctions[word.toLowerCase()];
        if (globalMethod){
            global.methodForDescription = { label: globalMethod.name, description: globalMethod.description };
            syntaxHelper.update(previewUri);
            vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(previewUriString), vscode.ViewColumn.Two).then((success) => {
            }, (reason) => {
                vscode.window.showErrorMessage(reason);
            });
            return;
        }
        // push the items
        let items = [];
        for (let element in global.globalfunctions) {
            let method = global.globalfunctions[element];
            items.push({ label: method.name, description: method.description });
        }
        // pick one
        let currentLine = vscode.window.activeTextEditor.selection.active.line + 1;
        let options = {
            placeHolder: "Введите название метода",
            matchOnDescription: false,
            onDidSelectItem: function (item) {
                global.methodForDescription = item;
                vscode.commands.executeCommand("editor.action.showHover");
            }
        };
        vscode.window.showQuickPick(items, options).then(function (selection) {
            if (typeof selection === "undefined") {
                return;
            }
            global.methodForDescription = selection;
            syntaxHelper.update(previewUri);
            vscode.commands.executeCommand("vscode.previewHtml", vscode.Uri.parse(previewUriString), vscode.ViewColumn.Two).then((success) => {
            }, (reason) => {
                vscode.window.showErrorMessage(reason);
            });
        });
    }));

    if (vscode.window.activeTextEditor) {
        applyConfigToTextEditor(vscode.window.activeTextEditor);
        global.getRefsLocal(vscode.window.activeTextEditor.document.fileName, vscode.window.activeTextEditor.document.getText());
    }
    global.updateCache();
}

function applyConfigToTextEditor(textEditor: vscode.TextEditor): any {

    if (!textEditor) {
        return;
    };
    let newOptions: vscode.TextEditorOptions = {
        "insertSpaces": false,
        "tabSize": 4
    };

    let defaultOptions: vscode.TextEditorOptions = {
        "insertSpaces": Boolean(vscode.workspace.getConfiguration("editor").get("insertSpaces")),
        "tabSize": Number(vscode.workspace.getConfiguration("editor").get("tabSize"))
    };

    if (vscode.languages.match(BSL_MODE, textEditor.document)) {
        if (textEditor.options.insertSpaces === defaultOptions.insertSpaces
            && (textEditor.options.tabSize === defaultOptions.tabSize)) {
            textEditor.options.insertSpaces = newOptions.insertSpaces;
            textEditor.options.tabSize = newOptions.tabSize;
        } else if (textEditor.options.insertSpaces === newOptions.insertSpaces && textEditor.options.tabSize === newOptions.tabSize) {
            textEditor.options.insertSpaces = defaultOptions.insertSpaces;
            textEditor.options.tabSize = defaultOptions.tabSize;
        }
    }
}