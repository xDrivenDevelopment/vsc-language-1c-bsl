import * as cp from "cross-spawn";
import * as fs from "fs-extra";
import * as glob from "glob";
import * as path from "path";

import FileQueue = require("filequeue");
import loki = require("lokijs");
import Parser = require("onec-syntaxparser");
import xml2js = require("xml2js");
const fq = new FileQueue(500);

import LibProvider, {
    IBSLClasses,
    IBSLMethods,
    IBSLPropertyDefinitions,
    IBSLSystemEnums
} from "./libProvider";
const libProvider = new LibProvider();

export class Global {
    public static create(adapter?: any): Global {
        if (!Global.instance) {
            Global.instance = new Global(adapter);
        }
        return Global.instance;
    }

    private static instance: Global;

    public cache: any;
    public db: any;
    public dbmodules: any;
    public dbvars: any;
    public dbcalls: Map<string, any[]>;
    public globalfunctions: IMethods;
    public globalvariables: IPropertyDefinitions;
    public keywords: IKeywordsForLanguage;
    public systemEnum: ISystemEnums;
    public classes: IClasses;
    public toreplaced: any;
    public methodForDescription: any = undefined;
    public syntaxFilled = "";
    public hoverTrue = true;
    public autocompleteLanguage: any;
    public dllData: object;
    public syntaxHelpersData: object = {};
    public libData: object = {};
    public libClasses: object = {};
    public subsystems: object = {};
    public oscriptCacheUpdated: boolean;
    public bslCacheUpdated: boolean;
    public contentData: object = {};

    constructor(adapter?: any) {
        if (adapter) {
            this.redefineMethods(adapter);
        }
        const configuration = this.getConfiguration("language-1c-bsl");
        this.autocompleteLanguage = this.getConfigurationKey(configuration, "languageAutocomplete");
        const postfix = this.autocompleteLanguage === "en" ? "_en" : "";
        this.toreplaced = this.getReplaceMetadata();
        this.cache = new loki("gtags.json");
        this.globalfunctions = {};
        this.globalvariables = {};
        this.systemEnum = {};
        this.classes = {};
        const globalfunctions: IBSLMethods = libProvider.bslglobals.globalfunctions;
        const globalvariables: IBSLPropertyDefinitions = libProvider.bslglobals.globalvariables;
        this.keywords = {};
        for (const keyword in libProvider.bslglobals.keywords[this.autocompleteLanguage]) {
            this.keywords[keyword.toLowerCase()] = keyword;
        }
        for (const key in globalfunctions) {
            const globalFunction = globalfunctions[key];
            const newName = globalFunction["name" + postfix];
            const newElement: IMethod = {
                name: newName,
                alias: postfix === "_en" ? globalFunction.name : globalFunction.name_en,
                description: globalFunction.description,
                signature: globalFunction.signature,
                returns: globalFunction.returns
            };
            this.globalfunctions[newName.toLowerCase()] = newElement;
        }
        const osGlobalfunctions: IBSLMethods = libProvider.oscriptStdLib.globalfunctions;
        this.addOscriptGlobalFunction(osGlobalfunctions, postfix);
        for (const element in globalvariables) {
            if (!globalvariables.hasOwnProperty(element)) {
                continue;
            }
            const newName = globalvariables[element]["name" + postfix];
            const newElement: IPropertyDefinition = {
                name: newName,
                alias:
                    postfix === "_en"
                        ? globalvariables[element].name
                        : globalvariables[element].name_en,
                description: globalvariables[element].description
            };
            this.globalvariables[newName.toLowerCase()] = newElement;
        }
        const osGlobalvariables: IBSLPropertyDefinitions =
            libProvider.oscriptStdLib.globalvariables;
        for (const key in osGlobalvariables) {
            if (!osGlobalvariables.hasOwnProperty(key)) {
                continue;
            }
            const variable = osGlobalvariables[key];
            if (this.globalvariables[variable["name" + postfix].toLowerCase()]) {
                const globVar = this.globalvariables[variable["name" + postfix].toLowerCase()];
                globVar.oscript_description = variable.description;
                globVar.oscript_access = variable.access;
            } else {
                const newName = variable["name" + postfix];
                const newElement: IPropertyDefinition = {
                    name: newName,
                    alias: postfix === "_en" ? variable.name : variable.name_en,
                    description: undefined,
                    oscript_description: variable.description,
                    oscript_access: variable.access
                };
                this.globalvariables[newName.toLowerCase()] = newElement;
            }
        }
        let systemEnum: IBSLSystemEnums = libProvider.bslglobals.systemEnum;
        for (const element in systemEnum) {
            if (!systemEnum.hasOwnProperty(element)) {
                continue;
            }
            const segment = systemEnum[element];
            const newName = segment["name" + postfix];
            const newElement: ISystemEnum = {
                name: newName,
                alias: postfix === "_en" ? segment.name : segment.name_en,
                description: segment.description,
                values: []
            };
            const values = segment.values;
            for (const key in values) {
                if (!values.hasOwnProperty(key)) {
                    continue;
                }
                const newNameValues = values[key]["name" + postfix];
                const elementValue: ISystemEnumValue = {
                    name: newNameValues,
                    alias: postfix === "_en" ? values[key].name : values[key].name_en,
                    description: values[key].description
                };
                newElement.values.push(elementValue);
            }
            this.systemEnum[newName.toLowerCase()] = newElement;
        }
        systemEnum = libProvider.oscriptStdLib.systemEnum;
        for (const element in systemEnum) {
            if (!systemEnum.hasOwnProperty(element)) {
                continue;
            }
            const segment = systemEnum[element];
            const newName = segment["name" + postfix];
            let findEnum: ISystemEnum;
            if (this.systemEnum[newName.toLowerCase()]) {
                findEnum = this.systemEnum[newName.toLowerCase()];
                findEnum.oscript_values = [];
            } else {
                findEnum = {
                    name: newName,
                    alias: postfix === "_en" ? segment.name : segment.name_en,
                    description: undefined,
                    values: [],
                    oscript_values: []
                };
                this.systemEnum[newName.toLowerCase()] = findEnum;
            }
            findEnum.oscript_description = segment.description;
            const values = segment.values;
            for (const key in values) {
                if (!values.hasOwnProperty(key)) {
                    continue;
                }
                const newNameValues = values[key]["name" + postfix];
                const elementValue: ISystemEnumValue = {
                    name: newNameValues,
                    alias: postfix === "_en" ? values[key].name : values[key].name_en,
                    description: values[key].description
                };
                findEnum.oscript_values.push(elementValue);
            }
            if (this.systemEnum[newName.toLowerCase()]) {
                this.systemEnum[newName.toLowerCase()] = findEnum;
            }
        }
        const classes: IBSLClasses = libProvider.bslglobals.classes;
        for (const element in classes) {
            if (!classes.hasOwnProperty(element)) {
                continue;
            }
            const segment = classes[element];
            const newName = segment["name" + postfix];
            const newElement: IClass = {
                name: newName,
                alias: postfix === "_en" ? segment.name : segment.name_en,
                description: segment.description,
                methods: segment.methods ? {} : undefined,
                properties: segment.properties ? {} : undefined,
                constructors: segment.constructors ? {} : undefined
            };
            for (const key in segment.methods) {
                const method = segment.methods[key];
                const newNameMethod = method["name" + postfix];
                const newMethod: IMethod = {
                    name: newNameMethod,
                    alias: postfix === "_en" ? method.name : method.name_en,
                    description: method.description,
                    signature: method.signature
                };
                newElement.methods[newNameMethod.toLowerCase()] = newMethod;
            }
            for (const key in segment.properties) {
                const property = segment.properties[key];
                const newNameProp = property["name" + postfix];
                const newProp: IPropertyDefinition = {
                    name: newNameProp,
                    alias: postfix === "_en" ? property.name : property.name_en,
                    description: property.description
                };
                newElement.properties[newNameProp.toLowerCase()] = newProp;
            }
            for (const key in segment.constructors) {
                const constructor = segment.constructors[key];
                const newCntr: IConstructorDefinition = {
                    signature: constructor.signature,
                    description: constructor.description
                };
                newElement.constructors[key.toLowerCase()] = newCntr;
            }
            this.classes[newName.toLowerCase()] = newElement;
        }
        const classesOscript: IBSLClasses = libProvider.oscriptStdLib.classes;
        this.addOscriptClasses(classesOscript, postfix);
    }

    public getCacheLocal(word: string, source, allToEnd = true, fromFirst = true) {
        const suffix = allToEnd ? "" : "$";
        const prefix = fromFirst ? "^" : "";
        const querystring = {
            name: { $regex: new RegExp(prefix + word + suffix, "i") }
        };
        return new Parser()
            .parse(source)
            .getMethodsTable()
            .find(querystring);
    }

    public getRefsLocal(filename: string, source: string) {
        const parsesModule = new Parser().parse(source);
        const entries = parsesModule.getMethodsTable().find();
        const collection = this.cache.addCollection(filename);
        this.updateReferenceCallsOld(
            collection,
            parsesModule.context.CallsPosition,
            "GlobalModuleText",
            filename
        );
        for (const item of entries) {
            this.updateReferenceCallsOld(collection, item._method.CallsPosition, item, filename);
        }
        return collection;
    }

    public getReplaceMetadata() {
        return {
            CommonModules: "ОбщиеМодули",
            AccountingRegisters: "РегистрыБухгалтерии",
            AccumulationRegisters: "РегистрыНакопления",
            BusinessProcesses: "БизнесПроцессы",
            CalculationRegisters: "РегистрыРасчета",
            ChartsOfAccounts: "ПланыСчетов",
            ChartsOfCalculationTypes: "ПланыВидовРасчета",
            ChartsOfCharacteristicTypes: "ПланыВидовХарактеристик",
            Constants: "Константы",
            Catalogs: "Справочники",
            DataProcessors: "Обработки",
            DocumentJournals: "ЖурналыДокументов",
            Documents: "Документы",
            Enums: "Перечисления",
            ExchangePlans: "ПланыОбмена",
            InformationRegisters: "РегистрыСведений",
            Reports: "Отчеты",
            SettingsStorages: "ХранилищаНастроек",
            Tasks: "Задачи"
        };
    }

    public getMetadataForPath(fullpath: string, rootPath: string): any {
        const splitsymbol = "/";
        const moduleArray: string[] = fullpath
            .substr(rootPath.length + (rootPath.slice(-1) === "\\" ? 0 : 1))
            .split(splitsymbol);
        const filepath = fullpath;
        const hierarchy = moduleArray.length;
        let result: any;
        if (hierarchy > 3) {
            if (
                moduleArray[hierarchy - 1].startsWith("ObjectModule.bsl") &&
                moduleArray[hierarchy - 2].startsWith("Ext")
            ) {
                const meta: IMetaData = {
                    type: "ObjectModule",
                    fullpath: filepath,
                    parenttype: moduleArray[hierarchy - 4],
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("ManagerModule.bsl") &&
                hierarchy > 3 &&
                moduleArray[hierarchy - 2].startsWith("Ext")
            ) {
                const meta: IMetaData = {
                    type: "ManagerModule",
                    parenttype: moduleArray[hierarchy - 4],
                    fullpath: filepath,
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("RecordSetModule.bsl") &&
                hierarchy > 3 &&
                moduleArray[hierarchy - 2].startsWith("Ext")
            ) {
                const meta: IMetaData = {
                    type: "RecordSetModule",
                    parenttype: moduleArray[hierarchy - 4],
                    fullpath: filepath,
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("CommandModule.bsl") &&
                hierarchy > 5
            ) {
                const meta: IMetaData = {
                    type: "CommandModule",
                    parenttype: moduleArray[hierarchy - 6],
                    fullpath: filepath,
                    module:
                        moduleArray[hierarchy - 6] +
                        "." +
                        moduleArray[hierarchy - 5] +
                        "." +
                        moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 6).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("CommandModule.bsl") &&
                moduleArray[hierarchy - 4].startsWith("CommonCommands")
            ) {
                const meta: IMetaData = {
                    type: "CommandModule",
                    parenttype: moduleArray[hierarchy - 4],
                    fullpath: filepath,
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("Module.bsl") &&
                moduleArray[hierarchy - 4].startsWith("CommonModules")
            ) {
                const meta: IMetaData = {
                    type: "CommonModule",
                    parenttype: moduleArray[hierarchy - 4],
                    fullpath: filepath,
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("Module.bsl") &&
                moduleArray[hierarchy - 2].startsWith("Form")
            ) {
                const meta: IMetaData = {
                    type: "FormModule",
                    parenttype: moduleArray[hierarchy - 7],
                    fullpath: filepath,
                    module:
                        moduleArray[hierarchy - 7] +
                        "." +
                        moduleArray[hierarchy - 6] +
                        "." +
                        moduleArray[hierarchy - 4],
                    project: moduleArray.slice(0, hierarchy - 7).join("/")
                };
                result = meta;
            } else if (
                moduleArray[hierarchy - 1].startsWith("Module.bsl") &&
                moduleArray[hierarchy - 2].startsWith("Ext") &&
                moduleArray[hierarchy - 4].startsWith("WebServices")
            ) {
                const meta: IMetaData = {
                    type: "CommonModule",
                    parenttype: moduleArray[hierarchy - 4],
                    fullpath: filepath,
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                this.dbmodules.insert(meta);
            } else if (
                moduleArray[hierarchy - 1].startsWith("ValueManagerModule.bsl") &&
                hierarchy > 3 &&
                moduleArray[hierarchy - 2].startsWith("Ext")
            ) {
                const meta: IMetaData = {
                    type: "ValueManagerModule",
                    parenttype: moduleArray[hierarchy - 4],
                    fullpath: filepath,
                    module: moduleArray[hierarchy - 4] + "." + moduleArray[hierarchy - 3],
                    project: moduleArray.slice(0, hierarchy - 4).join("/")
                };
                result = meta;
            } else {
                console.error("error set metadata for " + fullpath);
            }
        }
        return result;
    }

    public getModuleForPath(fullpath: string, rootPath: string): string {
        const splitsymbol = "/";
        const moduleArray: string[] = fullpath
            .substr(rootPath.length + (rootPath.slice(-1) === "\\" ? 0 : 1))
            .split(splitsymbol);
        let moduleStr: string = "";
        const hierarchy = moduleArray.length;
        if (hierarchy > 3) {
            if (moduleArray[hierarchy - 4].startsWith("CommonModules")) {
                moduleStr = moduleArray[hierarchy - 3];
            } else if (hierarchy > 3 && this.toreplaced[moduleArray[hierarchy - 4]] !== undefined) {
                moduleStr =
                    this.toreplaced[moduleArray[hierarchy - 4]] + "." + moduleArray[hierarchy - 3];
            }
        }
        return moduleStr;
    }

    public getHumanMetadata(meta: any): string {
        const toReplacedPrefix = this.getReplaceMetadata();
        const toReplacedSuffix = {
            ObjectModule: "МодульОбъекта",
            ManagerModule: "МодульМенеджера",
            CommonModule: "МодульОбщий",
            CommandModule: "МодульКоманды",
            FormModule: "МодульФормы",
            RecordSetModule: "МодульНабораЗаписей",
            ValueManagerModule: "МодульМенеджераЗначений"
        };

        let locLabel: string = String(meta.module);
        if (!toReplacedPrefix[meta.parenttype]) {
            locLabel = locLabel.replace(meta.parenttype + ".", ""); // Для внешних обработок уберем "метаданные"
        }
        if (this.autocompleteLanguage === "ru") {
            if (toReplacedPrefix[meta.parenttype]) {
                locLabel = locLabel.replace(
                    meta.parenttype + ".",
                    toReplacedPrefix[meta.parenttype] + "."
                );
            }

            if (toReplacedSuffix[meta.type]) {
                locLabel = locLabel + "." + toReplacedSuffix[meta.type];
            }
        } else {
            locLabel = locLabel + "." + meta.type;
        }
        return locLabel;
    }

    public async waitForCacheUpdate() {
        while (!this.cacheUpdated()) {
            await this.delay(100);
        }
    }

    public addtocachefiles(files: string[], rootPath: string): any {
        const filesLength = files.length;
        const substrIndex = process.platform === "win32" ? 8 : 7;
        for (let i = 0; i < filesLength; ++i) {
            let fullpath = files[i].toString();
            fullpath = decodeURIComponent(fullpath);
            if (fullpath.startsWith("file:")) {
                fullpath = fullpath.substr(substrIndex);
            }
            fq.readFile(fullpath, { encoding: "utf8" }, (err, source: string) => {
                if (err) {
                    throw err;
                }
                const moduleStr: string = fullpath.endsWith(".bsl")
                    ? this.getModuleForPath(fullpath, rootPath)
                    : "";
                source = source.replace(/\r\n?/g, "\n");
                if (fullpath.endsWith(".bsl") && source.trim().length > 0) {
                    const metacollection = this.getMetadataForPath(fullpath, rootPath);
                    if (metacollection !== undefined) {
                        this.dbmodules.insert(metacollection);
                    }
                }
                const parsesModule = new Parser().parse(source);
                const entries = parsesModule.getMethodsTable().find();
                if (i % 100 === 0) {
                    this.postMessage("Обновляем кэш файла № " + i + " из " + filesLength, 2000);
                }
                if (parsesModule.context.CallsPosition.length > 0) {
                    this.updateReferenceCalls(
                        parsesModule.context.CallsPosition,
                        "GlobalModuleText",
                        fullpath
                    );
                }
                for (const item of entries) {
                    const method = {
                        name: item.name,
                        endline: item.endline,
                        context: item.context,
                        isproc: item.isproc
                    };
                    if (item._method.CallsPosition.length > 0) {
                        this.updateReferenceCalls(item._method.CallsPosition, method, fullpath);
                    }
                    const dbMethod = {
                        Params: item._method.Params,
                        IsExport: item._method.IsExport
                    };
                    const newItem: IMethodValue = {
                        name: String(item.name),
                        isproc: Boolean(item.isproc),
                        isExport: Boolean(item._method.IsExport),
                        line: item.line,
                        endline: item.endline,
                        context: item.context,
                        _method: dbMethod,
                        filename: fullpath,
                        module: moduleStr,
                        description: item.description
                    };
                    this.db.insert(newItem);
                }
                if (i === filesLength - 1) {
                    this.postMessage("Кэш обновлен");
                    this.bslCacheUpdated = true;
                }
            });
        }
    }

    public updateCache(): any {
        this.bslCacheUpdated = false;
        this.oscriptCacheUpdated = false;

        if (this.cache.getCollection("ValueTable")) {
            this.cache.removeCollection("ValueTable");
        }
        if (this.cache.getCollection("ValueTableModules")) {
            this.cache.removeCollection("ValueTableModules");
        }

        this.db = this.cache.addCollection("ValueTable");
        this.dbvars = this.cache.addCollection("ValueVars");
        this.dbcalls = new Map();
        this.dbmodules = this.cache.addCollection("ValueTableModules");

        const configuration = this.getConfiguration("language-1c-bsl");
        const basePath: string = String(this.getConfigurationKey(configuration, "rootPath"));
        let rootPath = this.getRootPath();

        const args: string[] = [];
        args.push("get");
        args.push("lib.system");

        const cwd = rootPath ? path.dirname(rootPath) : path.dirname("");
        const options = {
            cwd,
            env: process.env
        };
        let result = "";
        const oscriptConfig = cp.spawn("oscript-config", args, options);
        oscriptConfig.on("error", error => {
            if (error.toString().indexOf("ENOENT") > 0) {
                console.log("oscript-config isn't found. Is it installed?");
            } else {
                console.error(error);
            }
        });
        oscriptConfig.stderr.on("data", buffer => {
            result += buffer.toString();
        });
        oscriptConfig.stdout.on("data", buffer => {
            result += buffer.toString();
        });
        oscriptConfig.on("close", () => {
            try {
                result = result.trim();
                const lines = result.split(/\r?\n/);
                let libSearchPattern = "*/lib.config";
                for (const line of lines) {
                    const globOptions: glob.IOptions = {};
                    globOptions.nocase = true;
                    globOptions.cwd = line;
                    globOptions.absolute = true;
                    glob(libSearchPattern, globOptions, (err, files) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        this.addOscriptLibrariesToCache(files);
                    });
                }
                libSearchPattern = "**/syntaxHelp.json";
                for (const line of lines) {
                    const globOptions: glob.IOptions = {};
                    globOptions.nocase = true;
                    globOptions.cwd = line;
                    globOptions.absolute = true;
                    glob(libSearchPattern, globOptions, (err, files) => {
                        if (err) {
                            console.error(err);
                            return;
                        }
                        this.dllData = this.addOscriptDll(files);
                    });
                }
                const syntaxHelpers = [
                    path.join(
                        path.join(path.join(__dirname, "..", "..", "OneScript.Web"), "syntaxhelp"),
                        "syntaxhelp.WebHost.json"
                    )
                ];

                this.syntaxHelpersData = this.addOscriptDll(syntaxHelpers);
            } catch (e) {
                console.error(e);
            }
        });

        if (rootPath) {
            let searchPattern =
                basePath !== ""
                    ? basePath.substr(2) + "**/{classes,классы}/*.os"
                    : "**/{classes,классы}/*.os";
            const globOptions: glob.IOptions = {};
            globOptions.dot = true;
            globOptions.cwd = rootPath;
            globOptions.nocase = true;
            globOptions.absolute = true;
            glob(searchPattern, globOptions, (err, files) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.addOscriptFilesToCache("", files, true);
            });
            searchPattern =
                basePath !== ""
                    ? basePath.substr(2) + "**/{modules,модули}/*.os"
                    : "**/{modules,модули}/*.os";
            glob(searchPattern, globOptions, (err, files) => {
                if (err) {
                    console.error(err);
                    return;
                }
                this.addOscriptFilesToCache("", files);
            });
        }

        if (rootPath) {
            let searchPattern =
                basePath !== "" ? basePath.substr(2) + "/Subsystems/*.xml" : "Subsystems/*.xml";
            this.findSubsystems(searchPattern, rootPath);
            this.postMessage("Запущено заполнение кеша", 3000);
            rootPath = path.join(rootPath, basePath);
            searchPattern =
                basePath !== "" ? basePath.substr(2) + "/**/*.{bsl,os}" : "**/*.{bsl,os}";
            this.findFilesForCache(searchPattern, rootPath);
        } else {
            this.bslCacheUpdated = true;
        }
    }

    public customUpdateCache(source: string, filename: string) {
        if (!this.cacheUpdated()) {
            return;
        }
        const configuration = this.getConfiguration("language-1c-bsl");
        const basePath: string = String(this.getConfigurationKey(configuration, "rootPath"));
        const rootPath = path.join(this.getRootPath(), basePath);
        const fullpath = filename.replace(/\\/g, "/");
        const methodArray = this.db.find({ filename: { $eq: fullpath } });
        for (const element of methodArray) {
            this.db.remove(element.$loki);
        }
        const parsesModule = new Parser().parse(source);
        const moduleStr = this.getModuleForPath(fullpath, rootPath);
        const entries = parsesModule.getMethodsTable().find();
        for (const value of this.cache.getCollection(filename).data) {
            if (value.call.startsWith(".")) {
                continue;
            }
            if (value.call.indexOf(".") === -1) {
                continue;
            }
            const arrCalls = this.dbcalls.get(value.call);
            if (arrCalls) {
                for (let k = arrCalls.length - 1; k >= 0; --k) {
                    const it = arrCalls[k];
                    if (it.filename === fullpath) {
                        arrCalls.splice(k, 1);
                    }
                }
            }
        }
        this.cache.removeCollection(filename);
        this.getRefsLocal(filename, source);
        this.updateReferenceCalls(parsesModule.context.CallsPosition, "GlobalModuleText", fullpath);
        for (const item of entries) {
            this.updateReferenceCalls(item._method.CallsPosition, item, fullpath);
            const method = {
                Params: item._method.Params,
                IsExport: item._method.IsExport
            };
            const newItem = {
                name: String(item.name),
                isproc: Boolean(item.isproc),
                line: item.line,
                endline: item.endline,
                context: item.context,
                _method: method,
                filename: fullpath,
                module: moduleStr,
                description: item.description
            };
            this.db.insert(newItem);
        }
    }

    public queryref(word: string, collection: any, local = false): any {
        if (!collection) {
            return new Array();
        }
        const prefix = local ? "" : ".";
        const querystring = {
            call: { $regex: new RegExp(prefix + word + "$", "i") }
        };
        return collection
            .chain()
            .find(querystring)
            .simplesort("name")
            .data();
    }

    public querydef(module: string, all = true, lazy = false, db = this.db): any {
        // Проверяем локальный кэш.
        // Проверяем глобальный кэш на модули.
        if (!this.cacheUpdated()) {
            return new Array();
        } else {
            const prefix = lazy ? "" : "^";
            const suffix = all ? "" : "$";
            const querystring = {
                module: {
                    $regex: new RegExp(prefix + module + suffix, "i")
                }
            };
            return db
                .chain()
                .find(querystring)
                .simplesort("name")
                .data();
        }
    }

    public query(word: string, module: string, all = true, lazy = false): any {
        const prefix = lazy ? "" : "^";
        const suffix = all ? "" : "$";
        const querystring: any = {
            name: {
                $regex: new RegExp(prefix + word + suffix, "i")
            }
        };
        if (module && module.length > 0) {
            querystring.module = {
                $regex: new RegExp(`^${module}`, "i")
            };
        }
        const moduleRegexp = new RegExp(`^${module}$`, "i");
        function filterByModule(obj) {
            if (module && module.length > 0) {
                if (moduleRegexp.exec(obj.module) !== null) {
                    return true;
                } else {
                    return false;
                }
            }
            return true;
        }
        return this.db
            .chain()
            .find(querystring)
            .where(filterByModule)
            .simplesort("name")
            .data();
    }

    public GetSignature(entry) {
        let description = entry.description.replace(/\/\//g, "");
        description = description.replace(new RegExp("[ ]+", "g"), " ");
        const regExp = new RegExp(
            "^\\s*(Возвращаемое значение|Return value|Returns):?\\n\\s*([<\\wа-яА-Я\\.>]+)(.|\\n)*",
            "gm"
        );
        const retState = regExp.exec(description);
        let strRetState;
        if (retState) {
            strRetState = retState[2];
            description = description.substr(0, retState.index);
        }
        let paramsString = "(";
        const params = entry._method.Params;
        for (const element in params) {
            if (!params.hasOwnProperty(element)) {
                continue;
            }
            const nameParam = params[element];
            paramsString += paramsString === "(" ? "" : ", ";
            paramsString += nameParam.byval ? "Знач " : "";
            paramsString += nameParam.name;
            const re = new RegExp(
                `^\\s*(Параметры|Parameters)(.|\\n)*\\n\\s*${
                    nameParam.name
                }\\s*(-|–)\\s*([<\\wа-яА-Я\\.>]+)`,
                "gm"
            );
            const match: RegExpExecArray = re.exec(description);
            if (match) {
                paramsString = paramsString + ": " + match[4];
            }
            paramsString += nameParam.default ? ` = ${nameParam.default}` : "";
        }
        paramsString = paramsString + ")";
        if (strRetState) {
            paramsString = paramsString + ": " + strRetState;
        } else if (!entry.isproc) {
            paramsString = paramsString + ": Произвольный";
        }
        return {
            description,
            paramsString,
            strRetState,
            fullRetState: !retState ? "" : retState[0]
        };
    }

    public GetDocParam(description: string, param) {
        const optional = false;
        let descriptionParam = "";
        const re = new RegExp(
            `(Параметры|Parameters)(.|\\n)*\\n\\s*${param}\\s*(-|–)\\s*([<\\wа-яА-Я\\.>]+)\\s*-?\\s*((.|\\n)*)`,
            "g"
        );
        const match: RegExpExecArray = re.exec(description);
        if (match) {
            descriptionParam = match[5];
            const cast = new RegExp("\\n\\s*[<\\wа-яА-Я\\.>]+\\s*(-|–)\\s*", "g").exec(
                descriptionParam
            );
            if (cast) {
                descriptionParam = descriptionParam.substr(0, cast.index);
            }
        }
        return { optional, descriptionParam };
    }

    public redefineMethods(adapter) {
        const methodsList = [
            "postMessage",
            "getConfiguration",
            "getConfigurationKey",
            "getRootPath",
            "fullNameRecursor",
            "findFilesForCache"
        ];
        methodsList.forEach(element => {
            if (adapter.hasOwnProperty(element)) {
                this[element] = adapter[element];
            }
        });
    }

    // tslint:disable-next-line:variable-name
    public postMessage(_description: string, _interval?: number) {} // tslint:disable-line:no-empty

    // tslint:disable-next-line:variable-name
    public getConfiguration(_section: string): any {} // tslint:disable-line:no-empty

    // tslint:disable-next-line:variable-name
    public getConfigurationKey(_configuration, _key: string): any {} // tslint:disable-line:no-empty

    public getRootPath(): string {
        return "";
    }

    // tslint:disable-next-line:variable-name
    public fullNameRecursor(_word: string, _document, _range, _left: boolean): string {
        return "";
    }

    // tslint:disable-next-line:variable-name
    public findFilesForCache(_searchPattern: string, _rootPath: string) {} // tslint:disable-line:no-empty

    public readFileSync(fullpath, substrIndex) {
        fullpath = decodeURIComponent(fullpath);
        if (fullpath.startsWith("file:")) {
            fullpath = fullpath.substr(substrIndex);
        }
        let data;
        try {
            data = fs.readFileSync(fullpath, { encoding: "utf8"});
        } catch (err) {
            if (err) {
                console.log(err);
            }
        }
        return data;
    }

    private addOscriptDll(files: string[]) {
        const dataDll = {};
        for (const syntaxHelp of files) {
            let data;
            try {
                data = fs.readFileSync(syntaxHelp, { encoding: "utf8" });
                const pathDll = path.basename(path.dirname(path.dirname(syntaxHelp)));
                const dllDesc = JSON.parse(data);
                const readme = fs
                    .readdirSync(path.join(path.dirname(path.dirname(syntaxHelp))))
                    .join(";")
                    .match(/readme\.md/i);
                dataDll[pathDll] = dllDesc;
                if (readme) {
                        const pathToReadme = path.join(path.dirname(path.dirname(syntaxHelp)), readme[0]);
                        dataDll[pathDll].description =
                            (process.platform === "win32" ? "" : "file://") + pathToReadme;
                        
                        fs.readFile(pathToReadme, 'utf-8', (err, data) => {
                            if (err) {
                                return;    
                            } 
                            dataDll[pathDll].content = data;
                        });
                }
                const classesOscript: Object = dllDesc["classes"];
                const postfix = this.autocompleteLanguage === "en" ? "_en" : "";
                this.addOscriptGlobalFunction(dllDesc["globalfunctions"], postfix);
                this.addOscriptClasses(classesOscript, postfix);
            } catch (err) {
                if (err) {
                    console.log(err);
                    continue;
                }
            }
        }
        return dataDll;
    }

    private addOscriptGlobalFunction(osGlobalfunctions, postfix) {
        for (const methodKey in osGlobalfunctions) {
            const method = osGlobalfunctions[methodKey];
            if (this.globalfunctions[method["name" + postfix].toLowerCase()]) {
                const globMethod = this.globalfunctions[method["name" + postfix].toLowerCase()];
                globMethod.oscript_signature = method.signature;
                globMethod.oscript_description = method.description;
            } else {
                const newName = method["name" + postfix];
                const newElement: IMethod = {
                    name: newName,
                    alias: postfix === "_en" ? method.name : method.name_en,
                    description: undefined,
                    signature: undefined,
                    returns: method.returns,
                    oscript_signature: method.signature,
                    oscript_description: method.description
                };
                this.globalfunctions[newName.toLowerCase()] = newElement;
            }
        }
    }

    private addOscriptClasses(classesOscript, postfix) {
        for (const element in classesOscript) {
            if (!classesOscript.hasOwnProperty(element)) {
                continue;
            }
            const segment = classesOscript[element];
            const newName = segment["name" + postfix];
            if (this.classes[newName.toLowerCase()]) {
                const findClass = this.classes[newName.toLowerCase()];
                findClass.oscript_description = segment.description
                    ? segment.description
                    : findClass.description;
                for (const key in segment.methods) {
                    const nameMethod = segment.methods[key]["name" + postfix];
                    if (!findClass.methods) {
                        findClass.methods = {};
                    }
                    let findMethod = findClass.methods[nameMethod.toLowerCase()];
                    const desc = segment.methods[key].description;
                    if (!findMethod) {
                        findMethod = {
                            name: nameMethod,
                            alias:
                                postfix === "_en"
                                    ? segment.methods[key].name
                                    : segment.methods[key].name_en,
                            description: undefined,
                            oscript_description: desc ? desc : "",
                            signature: segment.methods[key].signature
                        };
                        findClass.methods[nameMethod.toLowerCase()] = findMethod;
                    } else {
                        findMethod.oscript_description = desc ? desc : "";
                    }
                }
                for (const key in segment.properties) {
                    const nameProp = segment.properties[key]["name" + postfix];
                    if (!findClass.properties) {
                        findClass.properties = {};
                    }
                    let findProp = findClass.properties[nameProp.toLowerCase()];
                    const desc = segment.properties[key].description;
                    if (!findProp) {
                        findProp = {
                            name: nameProp,
                            alias:
                                postfix === "_en"
                                    ? segment.properties[key].name
                                    : segment.properties[key].name_en,
                            description: undefined,
                            oscript_description: desc ? desc : ""
                        };
                        findClass.properties[nameProp.toLowerCase()] = findProp;
                    } else {
                        findProp.oscript_description = desc ? desc : "";
                    }
                }
                for (const key in segment.constructors) {
                    if (!findClass.constructors) {
                        findClass.constructors = {};
                    }
                    let findCntr = findClass.constructors[key.toLowerCase()];
                    const desc = segment.constructors[key].description;
                    if (!findCntr) {
                        findCntr = {
                            description: undefined,
                            oscript_description: desc ? desc : "",
                            signature: segment.constructors[key].signature
                        };
                        findClass.constructors[key.toLowerCase()] = findCntr;
                    } else {
                        findCntr.oscript_description = desc ? desc : "";
                    }
                }
            } else {
                const oscript_description = segment.description;
                const newElement: IClass = {
                    name: newName,
                    alias: postfix === "_en" ? segment.name : segment.name_en,
                    description: undefined,
                    oscript_description: oscript_description ? oscript_description : "",
                    methods: segment.methods ? {} : undefined,
                    properties: segment.properties ? {} : undefined,
                    constructors: segment.constructors ? {} : undefined
                };
                for (const key in segment.constructors) {
                    const desc = segment.constructors[key].description;
                    const newCntr: IConstructorDefinition = {
                        signature: segment.constructors[key].signature,
                        description: undefined,
                        oscript_description: desc ? desc : ""
                    };
                    newElement.constructors[key.toLowerCase()] = newCntr;
                }
                for (const key in segment.properties) {
                    const desc = segment.properties[key].description;
                    const newNameProp = segment.properties[key]["name" + postfix];
                    const newProp: IPropertyDefinition = {
                        name: newNameProp,
                        alias:
                            postfix === "_en"
                                ? segment.properties[key].name
                                : segment.properties[key].name_en,
                        description: undefined,
                        oscript_description: desc ? desc : ""
                    };
                    newElement.properties[newNameProp.toLowerCase()] = newProp;
                }
                for (const key in segment.methods) {
                    const desc = segment.methods[key].description;
                    const newNameMethod = segment.methods[key]["name" + postfix];
                    const newMethod: IMethod = {
                        name: newNameMethod,
                        alias:
                            postfix === "_en"
                                ? segment.methods[key].name
                                : segment.methods[key].name_en,
                        description: undefined,
                        oscript_description: desc ? desc : "",
                        signature: segment.methods[key].signature
                    };
                    newElement.methods[newNameMethod.toLowerCase()] = newMethod;
                }
                this.classes[newName.toLowerCase()] = newElement;
            }
        }
    }

    private findSubsystems(searchPattern: string, rootPath: string) {
        const globOptions: glob.IOptions = {};
        globOptions.dot = true;
        globOptions.cwd = rootPath;
        globOptions.nocase = true;
        globOptions.absolute = true;
        glob(searchPattern, globOptions, (err, files) => {
            if (err) {
                console.error(err);
                return;
            }
            this.addSubsystemsToCache(files);
        });
    }

    private async addSubsystemsToCache(files: string[]) {
        const filesLength = files.length;
        const substrIndex = process.platform === "win32" ? 8 : 7;
        for (let i = 0; i < filesLength; ++i) {
            const data = this.readFileSync(files[i].toString(), substrIndex);
            let result;
            try {
                result = await this.xml2json(data);
            } catch (err) {
                if (err) {
                    console.log(err);
                    continue;
                }
            }
            const propSubsys = result.MetaDataObject.Subsystem[0].Properties[0];
            const ChildObjects = result.MetaDataObject.Subsystem[0].ChildObjects[0];
            const content =
                propSubsys.Content.length === 0 || !propSubsys.Content[0].hasOwnProperty("xr:Item")
                    ? []
                    : propSubsys.Content[0]["xr:Item"];
            const object = [];
            for (const obj of content) {
                object.push(obj._);
            }
            const item = {
                name: propSubsys.Name[0],
                object,
                subsystems: ChildObjects.Subsystem ? ChildObjects.Subsystem : []
            };
            this.subsystems[item.name] = item;
        }
    }

    private delay(milliseconds: number) {
        return new Promise<void>(resolve => {
            setTimeout(resolve, milliseconds);
        });
    }

    private cacheUpdated(): boolean {
        return this.bslCacheUpdated && this.oscriptCacheUpdated;
    }

    private updateReferenceCalls(calls: any[], method: any, file: string): any {
        for (const value of calls) {
            if (value.call.startsWith(".")) {
                continue;
            }
            if (value.call.indexOf(".") === -1) {
                continue;
            }
            let arrCalls = this.dbcalls.get(value.call);
            if (!arrCalls) {
                this.dbcalls.set(value.call, []);
                arrCalls = this.dbcalls.get(value.call);
            }
            arrCalls.push({
                filename: file,
                call: value.call,
                line: value.line,
                character: value.character,
                name: String(method.name)
            });
        }
    }

    private updateReferenceCallsOld(collection: any, calls: any[], method: any, file: string): any {
        for (const value of calls) {
            if (value.call.startsWith(".")) {
                continue;
            }
            const newItem: IMethodValue = {
                name: String(method.name),
                filename: file,
                isproc: Boolean(method.isproc),
                isExport: Boolean(method.isExport),
                call: value.call,
                context: method.context,
                line: value.line,
                character: value.character,
                endline: method.endline
            };
            collection.insert(newItem);
        }
    }

    private async addOscriptLibrariesToCache(files: string[]) {
        for (const libConfig of files) {
            let data;
            try {
                data = fs.readFileSync(libConfig, { encoding: "utf8" });
            } catch (err) {
                if (err) {
                    console.log(err);
                    continue;
                }
            }
            let result;
            try {
                result = await this.xml2json(data);
            } catch (err) {
                if (err) {
                    console.log(err);
                    continue;
                }
            }

            if (!result) {
                continue;
            }

            const packageDef = result["package-def"];
            if (!packageDef) {
                continue;
            }

            const modules = [];
            const classes = [];
            if (packageDef.hasOwnProperty("module")) {
                if (packageDef.module instanceof Array) {
                    for (const module of packageDef.module) {
                        modules.push(module);
                    }
                } else {
                    modules.push(packageDef.module);
                }
            }
            if (packageDef.hasOwnProperty("class")) {
                if (packageDef.class instanceof Array) {
                    for (const clazz of packageDef.class) {
                        classes.push(clazz);
                    }
                } else {
                    classes.push(packageDef.class);
                }
            }
            this.addOscriptFilesToCache(libConfig, modules);
            this.addOscriptFilesToCache(libConfig, classes, true);
        }
        this.oscriptCacheUpdated = true;
    }

    private addOscriptFilesToCache(libConfig, modules, isClasses = false) {
        const lib = path.basename(path.dirname(libConfig));
        for (const module of modules) {
            const fullpath = libConfig ? path.join(path.dirname(libConfig), module.$.file) : module;
            fq.readFile(fullpath, { encoding: "utf8" }, (err, source) => {
                if (err) {
                    throw err;
                }
                const moduleStr = libConfig ? module.$.name : path.parse(module).name;
                source = source.replace(/\r\n?/g, "\n");
                const parsesModule = new Parser().parse(source);
                const entries = parsesModule.getMethodsTable().find();
                const moduleDescr = moduleStr + ", " + (isClasses ? "класс" : "модуль");
                for (const exportVar in parsesModule.context.ModuleVars) {
                    if (parsesModule.context.ModuleVars[exportVar].isExport) {
                        if (!this.libData[lib]) {
                            const readme = fs
                                .readdirSync(path.join(path.dirname(libConfig)))
                                .join(";")
                                .match(/readme\.md/i);
                            this.libData[lib] = { modules: {}, content: '' };
                            if (readme) {
                                const pathToReadme = path.join(path.dirname(libConfig), readme[0]);
                                this.libData[lib].description =
                                    (process.platform === "win32" ? "" : "file://") + pathToReadme;
                                
                                fs.readFile(pathToReadme, 'utf-8', (err, data) => {
                                    if (err) {
                                        return;    
                                    } 
                                    this.libData[lib].content = data;
                                });
                            }
                        }
                        if (!this.libData[lib].modules[moduleDescr]) {
                            this.libData[lib].modules[moduleDescr] = {};
                        }
                        if (!this.libData[lib].modules[moduleDescr].properties) {
                            this.libData[lib].modules[moduleDescr].properties = {};
                            this.libData[lib].modules[moduleDescr].description = "";
                        }
                        this.libData[lib].modules[moduleDescr].properties[exportVar] = {
                            description: parsesModule.context.ModuleVars[exportVar].description,
                            alias: ""
                        };
                        const varItem: IVarsValue = {
                            name: String(exportVar),
                            _method: { IsExport: true },
                            filename: fullpath,
                            module: moduleStr,
                            description: parsesModule.context.ModuleVars[exportVar].description,
                            oscriptLib: true,
                            oscriptClass: isClasses
                        };
                        this.dbvars.insert(varItem);
                    }
                }
                for (const item of entries) {
                    const dbMethod = {
                        Params: item._method.Params,
                        IsExport: item._method.IsExport
                    };
                    const newItem: IMethodValue = {
                        name: String(item.name),
                        isproc: Boolean(item.isproc),
                        isExport: Boolean(item._method.IsExport),
                        line: item.line,
                        endline: item.endline,
                        context: item.context,
                        _method: dbMethod,
                        filename: fullpath,
                        module: moduleStr,
                        description: item.description,
                        oscriptLib: true,
                        oscriptClass: isClasses
                    };
                    if (item.name === "ПриСозданииОбъекта" || item._method.IsExport) {
                        const signature = this.GetSignature(newItem);
                        if (!this.libData[lib]) {
                            const readme = fs
                                .readdirSync(path.join(path.dirname(libConfig)))
                                .join(";")
                                .match(/readme\.md/i);
                                this.libData[lib] = { modules: {}, content: '' };
                            if (readme) {
                                const pathToReadme = path.join(path.dirname(libConfig), readme[0]);
                                this.libData[lib].description =
                                    (process.platform === "win32" ? "" : "file://") + pathToReadme;

                                fs.readFile(pathToReadme, 'utf-8', (err, data) => {
                                    if (err) {
                                        return;    
                                    } 
                                    this.libData[lib].content = data;
                                });
                            }
                        }
                        if (!this.libData[lib].modules[moduleDescr]) {
                            this.libData[lib].modules[moduleDescr] = {};
                        }
                        const regExpParams = new RegExp(
                            "^\\s*(Параметры|Parameters)\\:?s*\n*((.|\\n)*)",
                            "gm"
                        );
                        const paramsDesc = regExpParams.exec(signature.description);
                        let strParamsDesc = "";
                        if (paramsDesc) {
                            strParamsDesc = paramsDesc[2];
                            signature.description = signature.description.substr(
                                0,
                                paramsDesc.index
                            );
                        }
                        if (item.name === "ПриСозданииОбъекта") {
                            if (!this.libData[lib].modules[moduleDescr].constructors) {
                                this.libData[lib].modules[moduleDescr].constructors = {};
                                this.libData[lib].modules[moduleDescr].constructors[
                                    "По умолчанию"
                                ] = {
                                    description: signature.description
                                        .replace(/((.|\n)*.+)\n*/m, "$1")
                                        .replace(/\n/g, "<br>")
                                        .replace(/\t/g, ""),
                                    name: moduleStr,
                                    signature: {
                                        default: {
                                            СтрокаПараметров: signature.paramsString,
                                            Параметры: strParamsDesc
                                                .replace(/((.|\n)*.+)\n*/m, "$1")
                                                .replace(/\n/g, "<br>")
                                                .replace(/\t/g, "")
                                        }
                                    }
                                };
                            }
                            continue;
                        }
                        if (!this.libData[lib].modules[moduleDescr].methods) {
                            this.libData[lib].modules[moduleDescr].methods = {};
                            this.libData[lib].modules[moduleDescr].description = "";
                        }
                        const returnData = signature.fullRetState
                            .substring(25)
                            .replace(/((.|\n)*.+)\n*/m, "$1")
                            .replace(/\n/g, "<br>")
                            .replace(/\t/g, "");
                        this.libData[lib].modules[moduleDescr].methods[item.name] = {
                            description: signature.description
                                .replace(/((.|\n)*.+)\n*/m, "$1")
                                .replace(/\n/g, "<br>")
                                .replace(/\t/g, ""),
                            alias: "",
                            signature: {
                                default: {
                                    СтрокаПараметров: signature.paramsString,
                                    Параметры: strParamsDesc
                                        .replace(/((.|\n)*.+)\n*/m, "$1")
                                        .replace(/\n/g, "<br>")
                                        .replace(/\t/g, "")
                                }
                            },
                            returns: returnData
                        };
                    }
                    if (this.libData[lib] && this.libData[lib].modules[moduleDescr] && isClasses) {
                        this.libClasses[moduleStr.toLowerCase()] = {
                            name: moduleStr
                        };
                        if (this.libData[lib].modules[moduleDescr].constructors) {
                            this.libClasses[moduleStr.toLowerCase()].constructors = this.libData[
                                lib
                            ].modules[moduleDescr].constructors;
                        }
                    }
                    this.db.insert(newItem);
                }
            });
        }
    }

    private async xml2json(xml: string) {
        return new Promise((resolve, reject) => {
            const xml2jsParser = new xml2js.Parser();
            xml2jsParser.parseString(xml, (err, json) => {
                if (err) {
                    reject(err);
                } else {
                    resolve(json);
                }
            });
        });
    }
}

interface IMethodValue {
    // Имя процедуры/функции'
    name: string;
    // Процедура = true, Функция = false
    isproc: boolean;
    isExport: boolean;
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
    oscriptLib?: boolean;
    oscriptClass?: boolean;
}

interface IVarsValue {
    name: string;
    _method: Object;
    filename: string;
    module: string;
    description: string;
    oscriptLib?: boolean;
    oscriptClass?: boolean;
}

interface IMethods {
    [index: string]: IMethod;
}

interface IMethod {
    name: string;
    alias: string;
    description: string;
    signature: ISignatureCollection;
    returns?: string;
    oscript_description?: string;
    oscript_signature?: ISignatureCollection;
}

interface ISignatureCollection {
    default: ISignatureDefinition;
    [index: string]: ISignatureDefinition;
}

interface ISignatureDefinition {
    СтрокаПараметров: string;
    Параметры: ISignatureParameters;
}

interface ISignatureParameters {
    [index: string]: string;
}

interface IPropertyDefinitions {
    [index: string]: IPropertyDefinition;
}

interface IPropertyDefinition {
    name: string;
    alias: string;
    description: string;
    oscript_description?: string;
    access?: string;
    oscript_access?: string;
}

interface ISystemEnums {
    [index: string]: ISystemEnum;
}

interface ISystemEnum {
    name: string;
    alias: string;
    description: string;
    oscript_description?: string;
    values: ISystemEnumValue[];
    oscript_values?: IBSLSystemEnumValue[];
}

interface IBSLSystemEnumValue {
    name?: string;
    name_en?: string;
    description?: string;
}

interface ISystemEnumValue {
    name?: string;
    alias?: string;
    description?: string;
}

interface IClasses {
    [index: string]: IClass;
}

interface IClass {
    name: string;
    alias: string;
    description: string;
    oscript_description?: string;
    methods?: IMethods;
    properties?: IPropertyDefinitions;
    constructors?: IConstructorDefinitions;
}

interface IConstructorDefinitions {
    [index: string]: IConstructorDefinition;
}

interface IConstructorDefinition {
    description?: string;
    signature: string;
    oscript_description?: string;
    params?: ISignatureParameters;
}

interface IKeywordsForLanguage {
    [index: string]: string;
}

interface IMetaData {
    description?: string;
    module?: string;
    type?: string; // Оставим пока строка.
    parenttype?: string; // CommonModules, Documets, ExternalDataProcessor
    fullpath: string;
    project?: string;
}
