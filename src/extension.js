var vscode = require('vscode');

var bslProviders = require('./providers');

function activate(context) {
    
  context.subscriptions.push(vscode.languages.registerDocumentSymbolProvider("bsl", new bslProviders.DocumentSymbolProvider()));

  context.subscriptions.push(vscode.languages.registerDefinitionProvider("bsl", new bslProviders.DefinitionProvider()));

  context.subscriptions.push(vscode.languages.registerCompletionItemProvider("bsl", new bslProviders.CompletionItemProvider(), '.', '='));

  vscode.languages.setLanguageConfiguration("bsl", {

    indentationRules: {
      decreaseIndentPattern: /^\s*(конецесли|конеццикла|конецпроцедуры|конецфункции|иначе|иначеесли|конецпопытки|исключение|endif|enddo|endprocedure|endfunction|else|elseif|endtry|except).*$/i,
      increaseIndentPattern: /^\s*(пока|процедура|функция|если|иначе|иначеесли|попытка|исключение|для|while|procedure|function|if|else|elseif|try|for)[^;]*$/i
    },
    comments: {
      lineComment: '//'
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
      lineComment: '//'
    }

  });
  
  context.subscriptions.push(new bslProviders.LintProvider(context));
  
  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(function (textEditor) {
    applyConfigToTextEditor(textEditor);
  }));
  applyConfigToTextEditor(vscode.window.activeTextEditor);

}

exports.activate = activate;

function applyConfigToTextEditor(textEditor) {
  if (textEditor == null) {
    return;
  }
  var newOptions = {
    "insertSpaces" : false,
    "tabSize" : 4
  };
  var defaultOptions = {
    "insertSpaces" : vscode.workspace.getConfiguration("editor").get("insertSpaces"),
    "tabSize" : vscode.workspace.getConfiguration("editor").get("tabSize")
  };
  if (textEditor.document.languageId == "bsl") {
    if (textEditor.options.insertSpaces == defaultOptions.insertSpaces && (textEditor.options.tabSize == defaultOptions.tabSize || defaultOptions.tabSize == "auto")) {
      textEditor.options = newOptions;
    }
  } else {
    if (textEditor.options.insertSpaces == newOptions.insertSpaces && textEditor.options.tabSize == newOptions.tabSize) {
      textEditor.options = defaultOptions
    }
  }
}
