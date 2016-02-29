// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from "vscode";
import {Global} from "./global";
import CompletionItemProvider from "./features/completionItemProvider";
import DefinitionProvider from "./features/definitionProvider";
import DocumentSymbolProvider from "./features/documentSymbolProvider";
import ReferenceProvider from "./features/referenceProvider";
import GlobalCommandProvider from "./features/commandProvider";

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
    console.log("Congratulations, your extension 'language-1c-bsl' is now active!");

    const global = new Global("global");
    context.subscriptions.push(vscode.languages.registerCompletionItemProvider(["bsl", "bsl"], new CompletionItemProvider(global), ".", "="));
    context.subscriptions.push(vscode.languages.registerDefinitionProvider(["bsl", "bsl"], new DefinitionProvider(global)));
    context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(["bsl", "bsl"], new DocumentSymbolProvider(global)));
    context.subscriptions.push(vscode.languages.registerReferenceProvider(["bsl", "bsl"], new ReferenceProvider(global)));
    
    let commands = new GlobalCommandProvider(global);
    //commands.registerCommands(context);
    context.subscriptions.push(vscode.commands.registerCommand("bsl.update", () => {
        let filename = vscode.window.activeTextEditor.document.fileName;
        global.updateCache(filename);
    }));
    
    vscode.languages.setLanguageConfiguration("bsl", {
       indentationRules: {
      decreaseIndentPattern: /^\s*(конецесли|конеццикла|конецпроцедуры|конецфункции|иначе|иначеесли|конецпопытки|исключение|endif|enddo|endprocedure|endfunction|else|elseif|endtry|except).*$/i,
      increaseIndentPattern: /^\s*(пока|процедура|функция|если|иначе|иначеесли|попытка|исключение|для|while|procedure|function|if|else|elseif|try|for)[^;]*$/i
    },
    comments: {
      lineComment: "//"
    },
    onEnterRules: [
      {
        beforeText: /^\s*\|([^\"]|"[^\"]*")*$/,
        action: { indentAction: vscode.IndentAction.None, appendText: '|' }
      },
      {
        beforeText: /^([^\|\"]|"[^\"]*")*\"[^\"]*$/,
        action: { indentAction: vscode.IndentAction.None, appendText: '|' }
      }

    ]
   });

   vscode.languages.setLanguageConfiguration("sdbl", {

    comments: {
      lineComment: "//"
    }

  });

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(function (textEditor: vscode.TextEditor) {
      applyConfigToTextEditor(textEditor);
  }))

    //context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider(['bsl', 'bsl'], new DocumentSymbolProvider(global)));
	//context.subscriptions.push(vscode.languages.registerReferenceProvider(['bsl', 'bsl'], new ReferenceProvider(global)));
}

function applyConfigToTextEditor(textEditor: vscode.TextEditor): any {

    if (!textEditor) {
        return ;
    };
    let  newOptions = {
        "insertSpaces" : false,
        "tabSize" : 4
    };

    let defaultOptions = {
        "insertSpaces" : vscode.workspace.getConfiguration("editor").get("insertSpaces"),
        "tabSize" : vscode.workspace.getConfiguration("editor").get("tabSize")
    };
    
    if (textEditor.document.languageId === "bsl"){
        if (textEditor.options.insertSpaces === defaultOptions.insertSpaces
            && (textEditor.options.tabSize === defaultOptions.tabSize || defaultOptions.tabSize === "auto")) {
                textEditor.options = newOptions;
        } else if (textEditor.options.insertSpaces === newOptions.insertSpaces && textEditor.options.tabSize === newOptions.tabSize) {
            // textEditor.options.insertSpaces = defaultOptions.insertSpaces;
            // textEditor.options.tabSize = vscode.workspace.getConfiguration("editor").get("tabSize");
            
        }
        
    }
}