import * as fs from "fs";
import * as path from "path";

import * as bslglobals from "./features/bslGlobals";
// import keyword from "./features/bslGlobals";

let exec = require("child-process-promise").exec;
let iconv = require("iconv-lite");
let loki = require("lokijs");
let Parser = require("onec-syntaxparser");

import * as vscode from "vscode";

export class Global {
    exec: string;
    cache: any;
    db: any;
    dblocal: any;
    dbcalls: any;
    globalfunctions: any;
    globalvariables: any;
    keywords: any;

    getCacheLocal(filename: string, word: string, source, update: boolean = false, allToEnd: boolean = true, fromFirst: boolean = true) {
        let suffix = allToEnd  ? "" : "$";
        let prefix = fromFirst ? "^" : "";
        let querystring = {"name": {"$regex": new RegExp(prefix + word + suffix, "i")}};
        let entries = new Parser().parse(source).getMethodsTable().find(querystring);
        return entries;
    }

    getReplaceMetadata () {
        return {
            "Catalogs": "Справочники",
            "Documents": "Документы",
            "AccumulationRegisters": "РегистрыНакопления",
            "BusinessProcesses": "БизнессПроцессы",
            "DataProcessors": "Обработки",
            "Reports": "Отчеты",
            "InformationRegisters": "РегистрыСведений",
            "ExchangePlans": "ПланыОбмена",
            "CalculationRegisters": "РегистрыРасчета"
        };
    }

    private addtocachefiles(files: Array<vscode.Uri>, isbsl: boolean = false): any {
        let failed = new Array();
        let rootPath = vscode.workspace.rootPath;
        let replaced = this.getReplaceMetadata();
        for (let i = 0; i < files.length; ++i) {
            let fullpath: string = decodeURIComponent(files[i].toString());
            if (fullpath.startsWith("file:")) {
                if (process.platform === "win32") {
                    fullpath = fullpath.substr(8);
                } else {
                    fullpath = fullpath.substr(7);
                }
            }
            let moduleArray: Array<string> = fullpath.substr(rootPath.length + 1).split("/");
            let module: string = "";
            if (isbsl) {
                let test = false;
                if (moduleArray.length > 1) {
                    if (moduleArray[0].startsWith("CommonModules")) {
                        module = moduleArray[1];
                        test = false;
                    } else if (moduleArray.length > 3 && replaced[moduleArray[0]] !== undefined) {
                        moduleArray[0] = replaced[moduleArray[0]];
                        module = moduleArray[0] + "." + moduleArray[1];
                        test = false;
                    }
                }
                if (!test) {
                    failed.push(moduleArray[0]);
                }
            };
            let source = fs.readFileSync(fullpath, "utf-8");
            let entries = new Parser().parse(source).getMethodsTable().find();
            let count = 0;
            let added = {};
            for (let y = 0; y < entries.length; ++y) {
                let item = entries[y];
                this.updateReferenceCalls(item._method.CallsPosition, item, fullpath, added);
                if (!item.isexport) {
                    continue;
                };
                item["filename"] = fullpath;
                let newItem: MethodValue = {
                    "name": String(item.name),
                    "isproc": Boolean(item.isproc),
                    "line": item.line,
                    "endline": item.endline,
                    "context": item.context,
                    "_method": item._method,
                    "filename": fullpath,
                    "module": module,
                    "description": item.description
                };
                ++count;
                this.db.insert(newItem);
            }
        }
        vscode.window.setStatusBarMessage("Обновлен список процедур.", 3000);
    }

    updateCache(filename: string = ""): any {
        console.log("update cache");
        this.cache = {};
        this.cache = new loki("gtags.json");
        let rootPath = vscode.workspace.rootPath;
        if (rootPath) {
            this.db = this.cache.addCollection("ValueTable");
            this.dbcalls = this.cache.addCollection("Calls");

            let self = this;
            if (path.extname(filename) === ".os") {
                let files = vscode.workspace.findFiles("**/*.os", "", 1000);
                files.then((value) => {
                    this.addtocachefiles(value, false);
                }, (reason) => {
                    console.log(reason);
                });
            } else if (path.extname(filename) === ".bsl") {
                let files = vscode.workspace.findFiles("**/*CommonModules*/**/*.bsl", "", 10000);
                files.then((value) => {
                    this.addtocachefiles(value, true);
                }, (reason) => {
                    console.log(reason);
                });
                files = vscode.workspace.findFiles("**/ManagerModule.bsl", "", 100000);
                files.then((value) => {
                    this.addtocachefiles(value, true);
                }, (reason) => {
                    console.log(reason);
                }
                );
            }
        }
    };

    queryref(word: string): any {
        let querystring = {"call": {"$regex": new RegExp("." + word + "$", "i")}};
        let search = this.dbcalls.chain().find(querystring).simplesort("name").data();
        return search;
    }

    private updateReferenceCalls(calls: Array<any>, method: any, file: string, added: any): any {
        if (!this.dbcalls) {
            this.dbcalls = this.cache.addCollection("Calls");
        }
        let self = this;
        for (let index = 0; index < calls.length; index++) {
            let value = calls[index];
            if (added[value.call] === true) {
                continue;
            };
            if (value.call.startsWith(".")) {
                continue;
            }
            added[value.call] = true;
            let newItem: MethodValue = {
                "name": String(method.name),
                "filename": file,
                "isproc": Boolean(method.isproc),
                "call": value.call,
                "context": method.context,
                "line": value.line,
                "character": value.character,
                "endline": method.endline
            };
            self.dbcalls.insert(newItem);
        }
    }

    querydef(filename: string, module: string, all: boolean = true, lazy: boolean = false): any {
        // Проверяем локальный кэш. 
        // Проверяем глобальный кэш на модули. 
        // console.log(filename);
        if (!this.cache) {
            this.updateCache(filename);
            return new Array();
        } else {
            let prefix = lazy ? "" : "^";
            let suffix = all  ? "" : "$";
            let querystring = {"module": {"$regex": new RegExp(prefix + module + suffix, "i")}};
            let search = this.db.chain().find(querystring).simplesort("name").data();
            return search;
        }
    }

    query(filename: string, word: string, module: string, all: boolean = true, lazy: boolean = false): any {
        if (!this.cache) {
            this.updateCache(filename);
            return new Array();
        } else {
            let prefix = lazy ? "" : "^";
            let suffix = all  ? "" : "$";
            let querystring = {"name": {"$regex": new RegExp(prefix + word + suffix, "i")}};
            if (module && module.length > 0) {
                querystring["module"] = {"$regex": new RegExp("^" + module + "", "i")};
            }
            let moduleRegexp = new RegExp("^" + module, "i");
            function filterByModule(obj) {
                if (module && module.length > 0) {
                    if (moduleRegexp.exec(obj.module) != null) {
                        return true;
                    } else {
                        return false;
                    }
                }
                return true;
            }
            let search = this.db.chain().find(querystring).where(filterByModule).simplesort("name").data();
            return search;
        }
    }

    fullNameRecursor(word: string, document: vscode.TextDocument, range: vscode.Range, left: boolean) {
        let result: string;
        let plus: number = 1;
        let newRange: vscode.Range;
        if (left) {
            plus = -1;
            newRange = new vscode.Range(new vscode.Position(range.start.line, range.start.character + plus), new vscode.Position(range.start.line, range.start.character));
        } else {
            newRange = new vscode.Range(new vscode.Position(range.end.line, range.end.character), new vscode.Position(range.end.line, range.end.character + plus));
        }
        let dot = document.getText(newRange);
        if (dot.endsWith(".")) {
            let newPosition: vscode.Position;
            if (left) {
                result = document.getText(document.getWordRangeAtPosition(newRange.start)) + "." + word;
                newPosition = new vscode.Position(newRange.start.line, newRange.start.character - 2);
            } else {
                result = word + "." + document.getText(document.getWordRangeAtPosition(newRange.start));
                newPosition = new vscode.Position(newRange.end.line, newRange.end.character + 2);
            }
            let newWord = document.getWordRangeAtPosition(newPosition);
            if (newWord) {
                return this.fullNameRecursor(result, document, newWord, left);
            }
            return result;
        } else {
            result = word;
            return result;
        }
    }

    constructor(exec: string) {
        let configuration = vscode.workspace.getConfiguration("language-1c-bsl");
        let autocompleteLanguage: any = configuration.get("languageAutocomplete");
        if (!autocompleteLanguage) {
            autocompleteLanguage = "ru";
        }
        this.globalfunctions = bslglobals.globalfunctions()[autocompleteLanguage];
        this.globalvariables = bslglobals.globalvariables()[autocompleteLanguage];
        this.keywords = bslglobals.keywords()[autocompleteLanguage];
    }
}

interface MethodValue {
    // 'Имя процедуры/функции'
    name: string;
    // 'Процедура = false, Функция = true
    isproc: boolean;
    // начало
    line: number;
    // конец процедуры
    endline: number;

    filename: string;
    // контекст НаСервере, НаКлиенте, НаСервереБезКонтекста
    context?: string;
    module?: string;
    description?: string;
    call?: string;
    character?: number;
    _method?: {};
}

/// <reference path="node.d.ts" />