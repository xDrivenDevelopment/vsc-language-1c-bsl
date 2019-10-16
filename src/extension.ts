// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from "fs";
import * as Path from "path";
import * as vscode from "vscode";
import { BSL_MODE, LANGUAGE_1C_BSL_CONFIG } from "./const";
import { Global } from "./global";

import BslQuickOpen from "./features/bslQuickOpen";
import CompletionItemProvider from "./features/completionItemProvider";
import DefinitionProvider from "./features/definitionProvider";
import DocumentFormattingEditProvider from "./features/documentFormattingEditProvider";
import DocumentSymbolProvider from "./features/documentSymbolProvider";
import HoverProvider from "./features/hoverProvider";
import LanguageClientProvider from "./features/languageClientProvider";
import LintProvider from "./features/lintProvider";
import ReferenceProvider from "./features/referenceProvider";
import SignatureHelpProvider from "./features/signatureHelpProvider";
import SyntaxHelper from "./features/syntaxHelper";
import TaskProvider from "./features/taskProvider";
import WorkspaseSymbolProvider from "./features/workspaceSymbolProvider";

import { CodeBeautyfier } from "./features/codeBeautifier";
import * as dynamicSnippets from "./features/dynamicSnippets";
import { MethodController } from "./features/methodController";
import { MethodDetect } from "./features/methodDetect";
import * as vscAdapter from "./vscAdapter";

import LibProvider from "./libProvider";

import * as decorator from "./features/annotations/decorator";
import { IFunctionCallObject } from "./features/annotations/functionCallObject";

const libProvider = new LibProvider();
let diagnostics: vscode.Diagnostic[];

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const CMD_UPDATE = "language-1c-bsl.update";
    const CMD_CREATECOMMENTS = "language-1c-bsl.createComments";
    const CMD_CREATEDESCRIPTIONAPIMODULE = "language-1c-bsl.createDescriptionAPIModule";
    const CMD_CREATEMARKDOWNTEXTAPI = "language-1c-bsl.createMarkdownTextWithAPI";
    const CMD_ADDCOMMENT = "language-1c-bsl.addComment";
    const CMD_EXPANDABBREVIATION = "language-1c-bsl.expandAbbreviation";
    const CMD_QUICKOPEN = "language-1c-bsl.quickopen";
    const CMD_OPENCONT = "language-1c-bsl.openContent";

    const global = Global.create(vscAdapter);
    const quickOpen = new BslQuickOpen(global);
    const taskProvider = new TaskProvider();

    vscode.workspace.onDidChangeConfiguration(taskProvider.onConfigurationChanged);
    taskProvider.onConfigurationChanged();

    context.subscriptions.push(
        vscode.languages.registerCompletionItemProvider(
            BSL_MODE,
            new CompletionItemProvider(global),
            ".",
            "="
        )
    );
    context.subscriptions.push(
        vscode.languages.registerDefinitionProvider(BSL_MODE, new DefinitionProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerReferenceProvider(BSL_MODE, new ReferenceProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerWorkspaceSymbolProvider(new WorkspaseSymbolProvider(global))
    );
    context.subscriptions.push(
        vscode.languages.registerSignatureHelpProvider(
            BSL_MODE,
            new SignatureHelpProvider(global),
            "(",
            ","
        )
    );
    context.subscriptions.push(
        vscode.languages.registerHoverProvider(BSL_MODE, new HoverProvider(global))
    );

    const configuration = vscode.workspace.getConfiguration(LANGUAGE_1C_BSL_CONFIG);
    const languageServerEnabled = Boolean(configuration.get("languageServerEnabled"));

    if (!languageServerEnabled) {
        context.subscriptions.push(
            vscode.languages.registerDocumentFormattingEditProvider(
                BSL_MODE,
                new DocumentFormattingEditProvider(global)
            )
        );
        context.subscriptions.push(
            vscode.languages.registerDocumentRangeFormattingEditProvider(
                BSL_MODE,
                new DocumentFormattingEditProvider(global)
            )
        );
        context.subscriptions.push(
            vscode.languages.registerDocumentSymbolProvider(
                BSL_MODE,
                new DocumentSymbolProvider(global)
            )
        );
    }

    const languageClientProvider = new LanguageClientProvider();
    languageClientProvider.registerLanguageClient(context);

    const syntaxHelper = new SyntaxHelper(global);
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider("syntax-helper", syntaxHelper)
    );

    const linter = new LintProvider();
    linter.activate(context.subscriptions);

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_UPDATE, () => {
            global.updateCache();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_CREATEDESCRIPTIONAPIMODULE, () => {
            createComments(global, true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_CREATECOMMENTS, () => {
            createComments(global, false);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_CREATEMARKDOWNTEXTAPI, () => {
            createMarkdown(global);
        })
    );

    vscode.languages.setLanguageConfiguration("bsl", {
        indentationRules: {
            decreaseIndentPattern: new RegExp(
                "^\\s*(конецесли|конеццикла|конецпроцедуры" +
                    "|конецфункции|иначе|иначеесли|конецпопытки|исключение|endif|enddo|endprocedure" +
                    "|endfunction|else|elseif|endtry|except).*$",
                "i"
            ),
            increaseIndentPattern: new RegExp(
                "^\\s*(пока|процедура|функция|если|иначе|иначеесли" +
                    "|попытка|исключение|для|while|procedure|function|if|else|elseif|try|for)[^;]*$",
                "i"
            )
        },
        comments: {
            lineComment: "//"
        },
        __characterPairSupport: {
            autoClosingPairs: [
                { open: "{", close: "}" },
                { open: "[", close: "]" },
                { open: "(", close: ")" },
                { open: '"', close: '"', notIn: ["string"] },
                { open: "'", close: "'", notIn: ["string", "comment"] },
                { open: "`", close: "`", notIn: ["string", "comment"] }
            ]
        },
        brackets: [["{", "}"], ["[", "]"], ["(", ")"]],
        onEnterRules: [
            {
                beforeText: /^\s*\|([^\"]|"[^\"]*")*$/,
                action: {
                    indentAction: vscode.IndentAction.None,
                    appendText: "|"
                }
            },
            {
                beforeText: /^([^\|\"]|"[^\"]*")*\"[^\"]*$/,
                action: {
                    indentAction: vscode.IndentAction.None,
                    appendText: "|"
                }
            }
        ]
    });

    vscode.languages.setLanguageConfiguration("sdbl", {
        comments: {
            lineComment: "//"
        },
        brackets: [["{", "}"], ["[", "]"], ["(", ")"]]
    });

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(
            async (textDocumentChangeEvent: vscode.TextDocumentChangeEvent) => {
                const editor = vscode.window.activeTextEditor;
                if (
                    !editor ||
                    editor.document.languageId !== "bsl" ||
                    textDocumentChangeEvent.contentChanges.length === 0
                ) {
                    return;
                }

                const autoClosingBrackets = Boolean(
                    vscode.workspace.getConfiguration("editor.autoClosingBrackets", editor.document.uri)
                );
                if (textDocumentChangeEvent.contentChanges[0].text.slice(-1) === "(") {
                    const contentChange = textDocumentChangeEvent.contentChanges[0];
                    const point = contentChange.range.start.character + contentChange.text.length;
                    const position = new vscode.Position(editor.selection.active.line, point);
                    if (autoClosingBrackets) {
                        editor.edit(editBuilder => {
                            editBuilder.insert(
                                new vscode.Position(position.line, position.character),
                                ")"
                            );
                        });
                    }
                    vscode.commands.executeCommand("editor.action.triggerParameterHints");
                    vscode.window.activeTextEditor.selection = new vscode.Selection(
                        position.line,
                        position.character,
                        position.line,
                        position.character
                    );
                }
            }
        )
    );

    const methodDetect = new MethodDetect();
    const controller = new MethodController(methodDetect);
    context.subscriptions.push(controller);
    context.subscriptions.push(methodDetect);

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_ADDCOMMENT, () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !editor.selection.isEmpty || editor.document.languageId !== "bsl") {
                return;
            }
            const position = editor.selection.active;

            const line = editor.document.lineAt(position.line);
            const indent = editor.document.getText(
                new vscode.Range(
                    line.lineNumber,
                    0,
                    line.lineNumber,
                    line.firstNonWhitespaceCharacterIndex
                )
            );

            if (line.text.match(/^\s*\/\/.*$/)) {
                editor.edit(editBuilder => {
                    editBuilder.insert(
                        new vscode.Position(position.line, position.character),
                        `\n${indent}//`
                    );
                });
            } else {
                editor.edit(editBuilder => {
                    editBuilder.insert(
                        new vscode.Position(position.line, position.character),
                        "\n" + indent
                    );
                });
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((textEditor: vscode.TextEditor) => {
            if (!textEditor) {
                return;
            }
            if (!global.cache.getCollection(textEditor.document.fileName)) {
                global.getRefsLocal(textEditor.document.fileName, textEditor.document.getText());
            }
            if (vscode.workspace.workspaceFolders) {
                for (const element of vscode.workspace.textDocuments) {
                    if (element.isDirty && element.languageId === "bsl") {
                        global.customUpdateCache(element.getText(), element.fileName);
                    }
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidSaveTextDocument((document: vscode.TextDocument) => {
            if (vscode.workspace.workspaceFolders) {
                global.customUpdateCache(document.getText(), document.fileName);
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_EXPANDABBREVIATION, () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || !editor.selection.isEmpty || editor.selection.active.character < 3) {
                vscode.commands.executeCommand("tab");
                return;
            }
            const position = editor.selection.active;
            const char = editor.document.getText(
                new vscode.Range(
                    new vscode.Position(position.line, position.character - 2),
                    position
                )
            );
            const textline = editor.document.getText(
                new vscode.Range(
                    new vscode.Position(position.line, 0),
                    new vscode.Position(position.line, position.character - 2)
                )
            );
            const regex = /([а-яё_\w]+\s?)$/i;
            const arrStrings = regex.exec(textline);
            if (arrStrings) {
                let postfix;
                switch (char) {
                    case "++":
                        postfix = " + 1;";
                        break;
                    case "--":
                        postfix = " - 1;";
                        break;
                    case "+=":
                        postfix = " + ";
                        break;
                    case "-=":
                        postfix = " - ";
                        break;
                    case "*=":
                        postfix = " * ";
                        break;
                    case "/=":
                        postfix = " / ";
                        break;
                    case "%=":
                        postfix = " % ";
                        break;
                    default:
                        vscode.commands.executeCommand("tab");
                        return;
                }
                const word = arrStrings[1];
                editor
                    .edit(editBuilder => {
                        editBuilder.replace(
                            new vscode.Range(
                                new vscode.Position(
                                    position.line,
                                    position.character - word.length - 2
                                ),
                                position
                            ),
                            `${word} = ${word}${postfix}`
                        );
                    })
                    .then(() => {
                        const newPosition = editor.selection.isReversed
                            ? editor.selection.anchor
                            : editor.selection.active;
                        editor.selection = new vscode.Selection(
                            newPosition.line,
                            newPosition.character,
                            newPosition.line,
                            newPosition.character
                        );
                    });
            } else {
                vscode.commands.executeCommand("tab");
            }
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("language-1c-bsl.dynamicSnippets", () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor || editor.selection.isEmpty) {
                return;
            }
            const dynamicSnippetsCollection = {};
            for (const element in dynamicSnippets.dynamicSnippets()) {
                const snippet = dynamicSnippets.dynamicSnippets()[element];
                dynamicSnippetsCollection[element] = snippet;
            }
            const configuration = vscode.workspace.getConfiguration(LANGUAGE_1C_BSL_CONFIG);
            const userDynamicSnippetsList: string[] = configuration.get("dynamicSnippets", []);
            for (const index of userDynamicSnippetsList) {
                try {
                    const userDynamicSnippetsString = fs.readFileSync(
                        userDynamicSnippetsList[index],
                        "utf-8"
                    );
                    const snippetsData = JSON.parse(userDynamicSnippetsString);
                    for (const element in snippetsData) {
                        const snippet = snippetsData[element];
                        dynamicSnippetsCollection[element] = snippet;
                    }
                } catch (error) {
                    console.error(error);
                }
            }
            const items = [];
            for (const element in dynamicSnippetsCollection) {
                const snippet = dynamicSnippetsCollection[element];
                const description = element === snippet.description ? "" : snippet.description;
                items.push({ label: element, description });
            }

            vscode.window.showQuickPick(items).then(selection => {
                if (!selection) {
                    return;
                }
                const indent = editor.document.getText(
                    new vscode.Range(
                        editor.selection.start.line,
                        0,
                        editor.selection.start.line,
                        editor.selection.start.character
                    )
                );
                let snippetBody: string = dynamicSnippetsCollection[selection.label].body;
                snippetBody = snippetBody.replace(/\n/gm, "\n" + indent);
                const t = editor.document.getText(editor.selection);
                const arrSnippet = snippetBody.split("$1");
                if (arrSnippet.length === 1) {
                    editor
                        .edit(editBuilder => {
                            editBuilder.replace(editor.selection, snippetBody.replace("$0", t));
                        })
                        .then(() => {
                            const position = editor.selection.isReversed
                                ? editor.selection.anchor
                                : editor.selection.active;
                            editor.selection = new vscode.Selection(
                                position.line,
                                position.character,
                                position.line,
                                position.character
                            );
                        });
                } else {
                    editor
                        .edit(editBuilder => {
                            editBuilder.replace(
                                editor.selection,
                                snippetBody.split("$1")[1].replace("$0", t)
                            );
                        })
                        .then(() => {
                            const position = editor.selection.isReversed
                                ? editor.selection.active
                                : editor.selection.anchor;
                            editor.selection = new vscode.Selection(
                                position.line,
                                position.character,
                                position.line,
                                position.character
                            );
                            editor.edit(editBuilder => {
                                editBuilder.insert(
                                    editor.selection.active,
                                    snippetBody.split("$1")[0].replace("$0", t)
                                );
                            });
                        });
                }
            });
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("language-1c-bsl.beautify", () => {
            CodeBeautyfier.beautify();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_QUICKOPEN, () => {
            quickOpen.quickOpen();
        })
    );

    context.subscriptions.push(
        // Command to hide / show annotations
        vscode.commands.registerCommand("language-1c-bsl.annotations.toggle", () => {
            const currentState = vscode.workspace.getConfiguration("language-1c-bsl.annotations")
                .get("enabled");
            vscode.workspace.getConfiguration("language-1c-bsl.annotations")
                .update("enabled", !currentState, true);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(CMD_OPENCONT, label => {
            global.methodForDescription = {
                label,
                description: "Экспортные методы bsl"
            };
            syntaxHelper.update(previewUri);
            vscode.commands.executeCommand("vscode.previewHtml", previewUri, vscode.ViewColumn.Two);
        })
    );

    const previewUriString = "syntax-helper://authority/Синтакс-Помощник";
    const previewUri = vscode.Uri.parse(previewUriString);

    context.subscriptions.push(
        vscode.languages.registerOnTypeFormattingEditProvider(
            BSL_MODE,
            new DocumentFormattingEditProvider(global),
            "\n"
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand("language-1c-bsl.syntaxHelper", () => {
            function fillLabel(label, description) {
                if (global.dllData && global.oscriptCacheUpdated) {
                    global.methodForDescription = { label, description };
                    syntaxHelper.update(previewUri);
                    vscode.commands.executeCommand(
                        "vscode.previewHtml",
                        previewUri,
                        vscode.ViewColumn.Two
                    );
                } else {
                    const interval = setInterval(() => {
                        vscode.window.setStatusBarMessage(
                            "Подождите, заполняется кэш связанных данных",
                            1000
                        );
                        if (global.dllData && global.oscriptCacheUpdated) {
                            global.methodForDescription = {
                                label,
                                description
                            };
                            syntaxHelper.update(previewUri);
                            vscode.commands.executeCommand(
                                "vscode.previewHtml",
                                previewUri,
                                vscode.ViewColumn.Two
                            );
                            clearInterval(interval);
                        }
                    }, 1000);
                }
            }

            let globalMethod;
            if (vscode.window.activeTextEditor) {
                const word = vscode.window.activeTextEditor.document.getText(
                    vscode.window.activeTextEditor.document.getWordRangeAtPosition(
                        vscode.window.activeTextEditor.selection.active
                    )
                );
                globalMethod = global.globalfunctions[word.toLowerCase()];
            }
            // push the items
            const items = [];
            items.push({ label: "OneScript", description: "OneScript" });
            items.push({ label: "1C", description: "1С" });
            items.push({
                label: "oscript-library",
                description: "oscript-library"
            });
            if (
                Object.keys(global.subsystems).length > 0 ||
                global.db.find({ isExport: true, module: { $ne: "" } }).length > 0
            ) {
                items.push({
                    label: "Экспортные методы bsl",
                    description: "Экспортные методы bsl"
                });
            }
            const syntaxHelpers = global.syntaxHelpersData;
            if (Object.keys(syntaxHelpers).length > 0) {
                for (const iterator in syntaxHelpers) {
                    items.push({ label: iterator, description: "Внешний СП" });
                }
            }
            const postfix = "";
            const isBsl: boolean =
                vscode.window.activeTextEditor &&
                vscode.window.activeTextEditor.document.fileName.endsWith(".bsl");
            if (isBsl && globalMethod) {
                for (const element in libProvider.bslglobals.structureMenu.global) {
                    const segment = libProvider.bslglobals.structureMenu.global[element];
                    if (segment[globalMethod.name] === "" || segment[globalMethod.alias] === "") {
                        fillLabel(globalMethod.name, "1С/Глобальный контекст/" + element);
                        return;
                    }
                }
            } else if (
                vscode.window.activeTextEditor &&
                vscode.window.activeTextEditor.document.languageId === "bsl" &&
                globalMethod
            ) {
                for (const element in libProvider.oscriptStdLib.structureMenu.global) {
                    const segment = libProvider.oscriptStdLib.structureMenu.global[element];
                    if (segment[globalMethod.name] === "" || segment[globalMethod.alias] === "") {
                        fillLabel(globalMethod.name, "OneScript/Глобальный контекст/" + element);
                        return;
                    }
                }
                for (const element in libProvider.bslglobals.structureMenu.global) {
                    const segment = libProvider.bslglobals.structureMenu.global[element];
                    if (segment[globalMethod.name] === "" || segment[globalMethod.alias] === "") {
                        fillLabel(globalMethod.name, "1С/Глобальный контекст/" + element);
                        return;
                    }
                }
            } else if (isBsl || global.syntaxFilled === "1C" || global.syntaxFilled === "BSL") {
                for (const elementSegment in libProvider.bslglobals.structureMenu.global) {
                    const segment = libProvider.bslglobals.structureMenu.global[elementSegment];
                    for (const element in segment) {
                        items.push({
                            label: element,
                            description: "1С/Глобальный контекст/" + elementSegment
                        });
                    }
                }
                for (const elementSegment in libProvider.bslglobals.classes) {
                    const class1C = libProvider.bslglobals.classes[elementSegment];
                    items.push({
                        label: elementSegment,
                        description: "1С/Классы/" + elementSegment
                    });
                    for (const sectionTitle in class1C) {
                        if (sectionTitle !== "properties" && sectionTitle !== "methods") {
                            continue;
                        }
                        for (const element in class1C[sectionTitle]) {
                            items.push({
                                label: `${elementSegment}.${element}`,
                                description: "1С/Классы/" + elementSegment
                            });
                        }
                    }
                }
                for (const elementSegment in libProvider.bslglobals.systemEnum) {
                    const class1C = libProvider.bslglobals.systemEnum[elementSegment];
                    items.push({
                        label: elementSegment,
                        description: "1С/Системные перечисления/" + elementSegment
                    });
                    for (const sectionTitle in class1C) {
                        if (sectionTitle !== "properties" && sectionTitle !== "methods") {
                            continue;
                        }
                        for (const element in class1C[sectionTitle]) {
                            items.push({
                                label: `${elementSegment}.${element}`,
                                description: "1С/Системные перечисления/" + elementSegment
                            });
                        }
                    }
                }
            } else if (
                (vscode.window.activeTextEditor &&
                    vscode.window.activeTextEditor.document.languageId === "bsl") ||
                global.syntaxFilled === "OneScript" ||
                global.syntaxFilled === "oscript-library"
            ) {
                for (const element in libProvider.oscriptStdLib.structureMenu.global) {
                    const segment = libProvider.oscriptStdLib.structureMenu.global[element];
                    for (const sectionTitle in segment) {
                        items.push({
                            label: sectionTitle,
                            description: "OneScript/Глобальный контекст/" + element
                        });
                    }
                }
                for (const element in libProvider.oscriptStdLib.classes) {
                    const classOscript = libProvider.oscriptStdLib.classes[element];
                    items.push({
                        label: classOscript["name" + postfix],
                        description: "OneScript/Классы/" + element
                    });
                    for (const sectionTitle in classOscript) {
                        if (sectionTitle !== "properties" && sectionTitle !== "methods") {
                            continue;
                        }
                        for (const indexMethod in classOscript[sectionTitle]) {
                            const method = classOscript[sectionTitle][indexMethod];
                            items.push({
                                label: `${classOscript["name" + postfix]}.${
                                    method["name" + postfix]
                                }`,
                                description: "OneScript/Классы/" + element
                            });
                        }
                    }
                }
                for (const element in libProvider.oscriptStdLib.systemEnum) {
                    const classOscript = libProvider.oscriptStdLib.systemEnum[element];
                    items.push({
                        label: classOscript["name" + postfix],
                        description: "OneScript/Системные перечисления/" + element
                    });
                    for (const sectionTitle in classOscript) {
                        if (sectionTitle !== "properties" && sectionTitle !== "methods") {
                            continue;
                        }
                        for (const indexMethod in classOscript[sectionTitle]) {
                            const method = classOscript[sectionTitle][indexMethod];
                            items.push({
                                label: `${classOscript["name" + postfix]}.${
                                    method["name" + postfix]
                                }`,
                                description: "OneScript/Системные перечисления/" + element
                            });
                        }
                    }
                }
            } else {
                return;
            }
            // pick one
            const options = {
                placeHolder: "Введите название метода",
                matchOnDescription: false
            };
            if (!global.syntaxFilled) {
                if (vscode.window.activeTextEditor.document.fileName.endsWith(".bsl")) {
                    fillLabel("1C", "1С");
                } else if (vscode.window.activeTextEditor.document.languageId === "bsl") {
                    fillLabel("OneScript", "OneScript");
                }
            } else {
                vscode.window.showQuickPick(items, options).then(selection => {
                    if (typeof selection === "undefined") {
                        return;
                    }
                    global.methodForDescription = selection;
                    syntaxHelper.update(previewUri);
                    vscode.commands.executeCommand(
                        "vscode.previewHtml",
                        previewUri,
                        vscode.ViewColumn.Two
                    );
                });
            }
        })
    );

    if (vscode.window.activeTextEditor) {
        global.getRefsLocal(
            vscode.window.activeTextEditor.document.fileName,
            vscode.window.activeTextEditor.document.getText()
        );
    }
    global.updateCache();

}

function createComments(global, all: boolean) {
    const editor = vscode.window.activeTextEditor;
    if (editor.document.languageId === "bsl") {
        const configuration = vscode.workspace.getConfiguration(LANGUAGE_1C_BSL_CONFIG);
        const aL: any = configuration.get("languageAutocomplete");
        const enMode: boolean = aL === "en";
        const positionStart = editor.selection.anchor;
        const positionEnd = editor.selection.active;
        const lineMethod = all
            ? editor.document.lineCount - 1
            : positionStart.line > positionEnd.line
            ? positionStart.line + 1
            : positionEnd.line + 1;
        const re = /^(Процедура|Функция|procedure|function)\s*([\wа-яё]+)/im;
        const arrComment = [];
        findMethod(lineMethod, re, editor, global, arrComment, all, enMode);
        insertComments(editor, arrComment);
    }
}

async function createMarkdown(global): Promise<void> {
    const editor = vscode.window.activeTextEditor;
    if (editor.document.languageId !== "bsl") {
        return;
    }
    const filepath = editor.document.fileName.replace(/\\/g, "/");
    const filename = Path.basename(filepath, Path.extname(filepath));
    const methods = global.db.find({
        filename: filepath
    });

    let md = "";
    md = `## ${filename}\n\n`;

    let constructor = "";
    let methodsDefinitions = "";
    const addedMethods = new Set<string>();

    for (const method of methods) {
        const isConstructor = (method.name as string).toUpperCase() === "ПРИСОЗДАНИИОБЪЕКТА";
        if (!(isConstructor || method._method.IsExport)) {
            continue;
        }

        if (addedMethods.has(method.name)) {
            continue;
        } else {
            addedMethods.add(method.name);
        }

        const procPrefix = method.isproc ? "Процедура" : "Функция";
        const isExport = method.isExport ? "Экспорт" : "";
        let params = "";
        method._method.Params.forEach(param => {
            if (param.byval) {
                params += "Знач ";
            }
            params += param.name;
            if (param.default) {
                params += ` = ${param.default}`;
            }
            params += ", ";
        });
        if (params.length > 0) {
            params = params.slice(0, params.length - 2);
        }

        const procDefinition = `${procPrefix} ${method.name}(${params}) ${isExport}`;

        let methodDefinition = `### ${method.name}\n`;
        methodDefinition += "\n";
        methodDefinition += "```bsl\n";
        methodDefinition += method.description + "\n";
        methodDefinition += procDefinition + "\n";
        methodDefinition += "```\n";
        methodDefinition += "\n";

        if (isConstructor) {
            constructor = methodDefinition;
        } else {
            methodsDefinitions += methodDefinition;
        }
    }

    md += constructor;
    md += methodsDefinitions;

    const saveDialogOptions: vscode.SaveDialogOptions = {
        filters: { Markdown: ["md"] }
    };
    vscode.window.showSaveDialog(saveDialogOptions).then(fileUri => {
        openEditor(fileUri, md);
    });
}

async function openEditor(fileUri, md) {
    try {
        fileUri.scheme = "untitled";
        const textDocument: vscode.TextDocument = await vscode.workspace.openTextDocument(fileUri);
        const openedEditor: vscode.TextEditor = await vscode.window.showTextDocument(
            textDocument,
            1,
            false
        );
        openedEditor.edit(edit => {
            edit.insert(new vscode.Position(0, 0), md);
        });
    } catch (error) {
        console.error(error);
    }
}

function findMethod(lineMethod, re, editor, global, arrComment, all, enMode) {
    for (let indexLine = lineMethod; indexLine >= 0; --indexLine) {
        const matchMethod = re.exec(editor.document.lineAt(indexLine).text);
        if (!matchMethod) {
            continue;
        }
        const methodData = global.getCacheLocal(
            matchMethod[2],
            editor.document.getText(),
            false
        )[0];
        if (all && (!methodData.isexport || methodData.description !== "")) {
            continue;
        }
        const comment = composeComment(methodData, matchMethod, enMode);
        const dataComment = { comment, indexLine };
        arrComment.push(dataComment);
        if (!all) {
            break;
        }
    }
}

function insertComments(editor, arrComment) {
    editor.edit(editBuilder => {
        for (const iterator of arrComment) {
            editBuilder.replace(new vscode.Position(iterator.indexLine, 0), iterator.comment);
        }
    });
}

function composeComment(methodData, matchMethod, enMode) {
    const functionKeyword = matchMethod[1].toLowerCase();
    const isFunc = functionKeyword === "function" || functionKeyword === "функция";
    let comment = "";
    const methodDescription = enMode
        ? isFunc
            ? "Function description"
            : "Procedure description"
        : isFunc
        ? "Описание функции"
        : "Описание процедуры";
    comment += `// <${methodDescription}>\n`;
    const params = methodData._method.Params;
    if (params.length > 0) {
        comment += "//\n";
        comment += enMode ? "// Parameters:\n" : "// Параметры:\n";
        comment = fillParams(params, comment, enMode);
    }
    if (isFunc) {
        comment += "//\n";
        if (enMode) {
            comment += "//  Returns:\n";
            comment += "//   <Type.Subtype> - <returned value description>\n";
        } else {
            comment += "//  Возвращаемое значение:\n";
            comment += "//   <Тип.Вид> - <описание возвращаемого значения>\n";
        }
    }
    comment += "//\n";
    return comment;
}

function fillParams(params, comment, enMode) {
    for (const element of params) {
        comment += "//   " + element.name;
        if (enMode) {
            comment += " - <Type.Subtype> - <parameter description>";
        } else {
            comment += " - <Тип.Вид> - <описание параметра>";
        }
        comment += "\n";
    }
    return comment;
}

export async function createDecorations(
            editor: vscode.TextEditor,
            sourceCode: string
        ): Promise<vscode.DecorationOptions[][]> {
    diagnostics = [];

    const decArray: vscode.DecorationOptions[] = [];
    const errDecArray: vscode.DecorationOptions[] = [];

    // get an array of all said function calls in the file
    let fcArray = getFunctionCalls(sourceCode, editor);

    // grab the definitions for any of the function calls which can find a definition
    fcArray = await getDefinitions(fcArray, editor.document.uri);

    // cache for documents so they aren't loaded for every single call
    const documentCache: any = {};

    // filter down to function calls which actually have a definition
    const callsWithDefinitions = fcArray.filter((item) => item.definitionLocation !== undefined);

    for (const fc of callsWithDefinitions) {
      await decorator.decorateFunctionCall(editor, documentCache, decArray, errDecArray, fc, diagnostics);
    }

    return [decArray, errDecArray];
}

function getFunctionCalls(sourceCode: string, editor: vscode.TextEditor): IFunctionCallObject[] {
    return null;
}

async function getDefinitions(fcArray: IFunctionCallObject[], uri: vscode.Uri): Promise<IFunctionCallObject[]> {
    return new Promise<IFunctionCallObject[]>(async (resolve) => {
        for (const fc of fcArray) {
            if (fc.functionRange === undefined) {
              continue;
            }
            // grab an array of locations for the definitions of a function call
            const locations = await vscode.commands.executeCommand<vscode.Location[]>(
                    "vscode.executeDefinitionProvider",
                    uri,
                    fc.functionRange.start
                );

            if (locations !== undefined && locations.length > 0) {
                //
            }
        }
    });
}
