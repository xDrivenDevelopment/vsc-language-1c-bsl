'use strict';

var cp = require('child_process');
var path = require('path');
var vscode = require('vscode');
var bslGlobals = require('./bslGlobals');
var configuration = vscode.workspace.getConfiguration('language-1c-bsl');
var autocomplitlanguage = configuration.get("languageAutocomplite");
if (!autocomplitlanguage){
    autocomplitlanguage = "ru";
}
    
var BSLDocumentSymbolProvider = (function () {
	function BSLDocumentSymbolProvider() {
		this.goKindToCodeKind = {
			"variable" : vscode.SymbolKind.Variable,
			"function" : vscode.SymbolKind.Function
		};
	}
	BSLDocumentSymbolProvider.prototype.provideDocumentSymbols = function (document, token) {
		var _this = this;
		return new Promise(function (resolve, reject) {
			var symbols = [];
			var text = document.getText();
			var KindToCodeKind = {
				"variable" : /(^|\s)(перем|var)\s+([a-zа-яё_][a-zа-яё_0-9]*)/ig,
				"function" : /(^|\s)(процедура|функция|procedure|function)\s+([a-zа-яё_][a-zа-яё_0-9]*)\s*\(/ig
			};
			var ArrayKind = ["variable", "function"];
			ArrayKind.forEach(function (Kind) {
				var valueMatch = KindToCodeKind[Kind];
				var match = null;
				while (match = valueMatch.exec(text)) {
					var word = match[3];
					var indexWord = text.indexOf(match[0]) + match[0].indexOf(word);
					var lineWord = 0;
					var characterWord = indexWord;
					var endWord = indexWord + word.length;
					var pos = text.indexOf("\n");
					while (pos != -1 && pos <= indexWord) {
						lineWord++;
						if (pos <= indexWord) {
							characterWord = indexWord - pos - 1;
							endWord = characterWord + word.length;
						}
						pos = text.indexOf("\n", pos + 2);
					}
					var symbolInfo = new vscode.SymbolInformation(word, _this.goKindToCodeKind[Kind], new vscode.Range(new vscode.Position(lineWord, characterWord), new vscode.Position(lineWord, endWord)), undefined);
					symbols.push(symbolInfo);
				}
			})

			try {
				return resolve(symbols);
			} catch (e) {
				reject(e);
			}

		});
	};
	return BSLDocumentSymbolProvider;
})();

var BSLDefinitionProvider = (function () {
	function BSLDefinitionProvider() {}
	BSLDefinitionProvider.prototype.provideDefinition = function (document, position, token) {
		var _this = this;

		var line = position.line;
		var RangeWord = document.getWordRangeAtPosition(position);
		var currentWord = document.getText(RangeWord);
		var offset = RangeWord.end.character;

		var typeOf = null;
		while (typeOf == null) {
			if (offset == document.lineAt(line).text.length) {
				line++;
				offset = 1;
			} else {
				offset++;
			}
			var lastOne = document.getText(new vscode.Range(new vscode.Position(line, offset - 1), new vscode.Position(line, offset)))
				if (lastOne != " ") {
					if (lastOne == "(") {
						typeOf = "function";
					} else {
						typeOf = "variable"
					}
				}
		}
		var text = document.getText();
		var RegexVar = new RegExp('(перем|var)\\s+(' + currentWord + ')', 'ig');
		var RegexMethod = new RegExp('(процедура|функция|procedure|function)\\s+(' + currentWord + ')\\s*\\(', 'ig');
		var match = null;
		if (typeOf == "variable") {
			match = RegexVar.exec(text);
		} else {
			match = RegexMethod.exec(text);
		}
		if (match) {
			var word = match[2];
			var indexWord = text.indexOf(match[0]) + match[0].indexOf(word);
			var lineWord = 0;
			var characterWord = indexWord;
			var endWord = indexWord + word.length;
			var pos = text.indexOf("\n");
			while (pos != -1 && pos <= indexWord) {
				lineWord++;
				if (pos <= indexWord) {
					characterWord = indexWord - pos - 1;
					endWord = characterWord + word.length;
				}
				pos = text.indexOf("\n", pos + 2);
			}
			return new vscode.Location(document.uri, new vscode.Range(new vscode.Position(lineWord, characterWord), new vscode.Position(lineWord, endWord)));
		}
	};
	return BSLDefinitionProvider;
})();

var BSLCompletionItemProvider = (function () {
  function BSLCompletionItemProvider() {
    this.triggerCharacters = ['.', '='];
  }
  BSLCompletionItemProvider.prototype.provideCompletionItems = function (document, position, token) {
    var result = [];
    var added = {};
    var wordAutocomplite = document.getText(document.getWordRangeAtPosition(position));
    //console.log("BSLCompletionItemProvider"+wordAutocomplite);
    var createNewProposal = function (kind, name, entry) {
      var proposal = new vscode.CompletionItem(name);
      proposal.kind = kind;
      if (entry) {
        if (entry.description) {
          proposal.documentation = entry.description;
        }
        if (entry.signature) {
          proposal.detail = entry.signature;
        }
      }
      return proposal;
    };
    
    var wordMatch = new RegExp(".*", "i");
    if (wordAutocomplite.length > 0) {
        wordMatch = new RegExp(wordAutocomplite, "i");    
    }
    
    try {
        for (var name in bslGlobals.globalvariables[autocomplitlanguage]) {
            if (bslGlobals.globalvariables[autocomplitlanguage].hasOwnProperty(name) && wordMatch.exec(name)!=null) {
                added[name] = true;
                result.push(createNewProposal(vscode.CompletionItemKind.Variable, name, bslGlobals.globalvariables[autocomplitlanguage][name]));
            }
        }
        for (var name in bslGlobals.globalfunctions[autocomplitlanguage]) {
            if (bslGlobals.globalfunctions[autocomplitlanguage].hasOwnProperty(name) && wordMatch.exec(name)!=null) {
                added[name] = true;
                result.push(createNewProposal(vscode.CompletionItemKind.Function, name, bslGlobals.globalfunctions[autocomplitlanguage][name]));
            }
        }
        for (var name in bslGlobals.keywords[autocomplitlanguage]) {
            if (bslGlobals.keywords[autocomplitlanguage].hasOwnProperty(name) && wordMatch.exec(name)!=null) {
                added[name] = true;
                result.push(createNewProposal(13, name, bslGlobals.keywords[autocomplitlanguage][name]));
            }
        }    
    
    } catch (error) {
        console.error(error)
    }
    var text = document.getText();
    var variableMatch = /(^|\s)(перем|var)\s+([a-zа-яё_][a-zа-яё_0-9]*)/ig;
    var match = null;
    while (match = variableMatch.exec(text)) {
      var word = match[3];
      if (!added[word] || wordMatch.exec(word) != null) {
        added[word] = true;
        result.push(createNewProposal(vscode.CompletionItemKind.Variable, word, null));
      }
    }
    var functionMatch = /(^|\s)(процедура|функция|procedure|function)\s+([a-zа-яё_][a-zа-яё_0-9]*)\s*\(/ig;
    var match = null;
    while (match = functionMatch.exec(text)) {
      var word = match[3];
      if (!added[word] && wordMatch.exec(word) != null ) {
        added[word] = true;
        result.push(createNewProposal(vscode.CompletionItemKind.Function, word, null));
      }
    }
    
    for (var S = text.split(/[^а-яёА-ЯЁ_a-zA-Z]+/), _ = 0; _ < S.length; _++) {
      var word = S[_].trim();
      if (!added[word] && word.length > 5 && wordMatch.exec(word) != null) {
          if (word == wordAutocomplite){
              continue;
          }
        added[word] = true;
        result.push(createNewProposal(vscode.CompletionItemKind.Text, word, null));
      }
    }
    return Promise.resolve(result);
  };
  return BSLCompletionItemProvider;
})(vscode.CompletionItem);

var BSLLintProvider = (function (_super) {
  function LintProvider(context) {
    this.context = context;
    this.initialize();
  }
  LintProvider.prototype.initialize = function () {
    var _this = this;
    this.diagnosticCollection = vscode.languages.createDiagnosticCollection("bsl");
    var disposable = vscode.workspace.onDidSaveTextDocument(function (e) {
      if (vscode.window.activeTextEditor._documentData._languageId !== "bsl") {
        return;
      }
      _this.lintDocument(vscode.window.activeTextEditor._documentData, vscode.window.activeTextEditor._documentData.getText().split(/\r?\n/g));
    });
    this.context.subscriptions.push(disposable);
    this.context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(function (textEditor) {
      if (vscode.window.activeTextEditor._documentData !== null && vscode.window.activeTextEditor._documentData._languageId == "bsl") {
        _this.lintDocument(vscode.window.activeTextEditor._documentData, vscode.window.activeTextEditor._documentData.getText().split(/\r?\n/g));
      };
    }));
    if (vscode.window.activeTextEditor._documentData !== null && vscode.window.activeTextEditor._documentData._languageId == "bsl") {
      _this.lintDocument(vscode.window.activeTextEditor._documentData, vscode.window.activeTextEditor._documentData.getText().split(/\r?\n/g));
    };
  };
  LintProvider.prototype.lintDocument = function (document, documentLines) {
    var _this = this;
    return new Promise(function (resolve, reject) {
      var linterEnabled = vscode.workspace.getConfiguration("language-1c-bsl").get("enableOneScriptLinter");
      if (!linterEnabled) {
          return;
      }
      var filename = document._uri._fsPath;
      var lintBSLFiles = vscode.workspace.getConfiguration("language-1c-bsl").get("lintBSLFiles");
      if (filename.endsWith(".bsl") && !lintBSLFiles) {
          return;
      }
      var args = ['-encoding=utf-8', '-check'];
      args.push(filename);
      var options = {
        cwd: path.dirname(filename),
        env: process.env
      };
      var result = "";
      var phpcs = cp.spawn("oscript", args, options);
      phpcs.stderr.on("data", function (buffer) {
        result += buffer.toString();
      });
      phpcs.stdout.on("data", function (buffer) {
        result += buffer.toString();
      });
      phpcs.on("close", function (code) {
        try {
          result = result.trim();
          var lines = result.split(/\r?\n/);
          var regex = /^\{Модуль\s+(.*)\s\/\s.*:\s+(\d+)\s+\/\s+(.*)\}/;
          var vscodeDiagnosticArray = [];
          for (var line in lines) {
            var match = null;
            match = lines[line].match(regex);
            if (match!=undefined) {
              var range = new vscode.Range(new vscode.Position(match[2]-1, 0), new vscode.Position(+match[2]-1, vscode.window.activeTextEditor._documentData._lines[match[2]-1].length));
              var vscodeDiagnostic = new vscode.Diagnostic(range, match[3], vscode.DiagnosticSeverity.Error);
               vscodeDiagnosticArray.push(vscodeDiagnostic);
            }
          }
          _this.diagnosticCollection.set(document._uri, vscodeDiagnosticArray);
          resolve();
        }
        catch (e) {
          reject(e);
        }
      });
    });
  };
  return LintProvider;
})();

Object.defineProperty(exports, "__esModule", {
	value : true
});

exports.DocumentSymbolProvider = BSLDocumentSymbolProvider;
exports.DefinitionProvider = BSLDefinitionProvider;
exports.CompletionItemProvider = BSLCompletionItemProvider;
exports.LintProvider = BSLLintProvider;
