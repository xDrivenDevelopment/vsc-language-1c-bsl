import * as glob from "glob";
import * as path from "path";
import * as vscode from "vscode";
import AbstractProvider from "./abstractProvider";
import AbstractSyntaxContent from "./AbstractSyntaxContent";
import SyntaxContent1C from "./SyntaxContent1C";
import SyntaxContentBSL from "./SyntaxContentBSL";
import SyntaxContentOscript from "./SyntaxContentOscript";
import SyntaxContentOscriptLibrary from "./SyntaxContentOscriptLibrary";
import SyntaxExternalHelper from "./SyntaxExternalHelper";

import * as fastXmlParser from "fast-xml-parser";

export default class SyntaxHelperProvider extends AbstractProvider {
    private syntaxContent: AbstractSyntaxContent;
    private webPanel: vscode.WebviewPanel;
    private syntax: string;
    private oscriptMethods: any;
    private metadata = [
        "CommonModules",
        "ExchangePlans",
        "SettingsStorages",
        "Constants",
        "Catalogs",
        "Documents",
        "DocumentJournals",
        "Enums",
        "Reports",
        "DataProcessors",
        "ChartsOfCharacteristicTypes",
        "ChartsOfAccounts",
        "ChartsOfCalculationTypes",
        "InformationRegisters",
        "AccumulationRegisters",
        "AccountingRegisters",
        "CalculationRegisters",
        "BusinessProcesses",
        "Tasks"
    ];

    public updateContentPanel(panel: vscode.WebviewPanel, updateContent: boolean) {   
        this.webPanel = panel;
        var result = this.provideTextDocumentContent(updateContent);
        result.then(
            value => panel.webview.html = value
        );
    }

    public provideTextDocumentContent(updateContent): Promise<string> | undefined {
        if (!this._global.methodForDescription) {
            return;
        }
        this.setupSyntaxContent();
        return this.buildHTMLDocument(updateContent);
    }

    private setupSyntaxContent() {
        const desc = this._global.methodForDescription.description;

        if (desc.split("/")[0] === "1С") {
            this.syntaxContent = new SyntaxContent1C();
            this.syntax = "1C";
        } else if (desc.split("/")[0] === "Экспортные методы bsl") {
            this.syntaxContent = new SyntaxContentBSL();
            this.syntax = "BSL";
        } else if (desc.split("/")[0] === "oscript-library") {
            this.syntaxContent = new SyntaxContentOscriptLibrary();
            this.syntax = "oscript-library";
        } else if (desc.split("/")[0] === "Внешний СП") {
            this.syntaxContent = new SyntaxExternalHelper();
            this.syntax = "Внешний СП";
        } else {
            this.syntaxContent = new SyntaxContentOscript();
            this.syntax = "OneScript";
        }
    }

    private createListMd(label): object {
        function compareModules(a, b) {
            if (a.module > b.module) {
                return 1;
            }
            if (a.module < b.module) {
                return -1;
            }
        }
        const items = {};
        const fillMD = label.indexOf("Metadata.") === -1 ? false : true;
        const labelMD = label.replace("Metadata.", "");
        for (const md of this.metadata) {
            let listMod = this._global.db.find({
                filename: { $regex: `.${md}.` },
                isExport: true,
                module: { $ne: "" }
            });
            if (listMod.length > 0) {
                items[this._global.toreplaced[md]] = [];
                if (fillMD && this._global.toreplaced[md] === labelMD) {
                    listMod = listMod.sort(compareModules);
                    const arr = {};
                    this.fillExportMethods(arr, listMod);
                    items[this._global.toreplaced[md]].push(arr);
                }
            }
        }
        return items;
    }

    private createListSubsystems(label) {
        const subsystems = {};
        const fillSubsystem = label.indexOf("Subsystem.") === -1 ? false : true;
        const labelSubsystem = label.replace("Subsystem.", "");
        for (const sub in this._global.subsystems) {
            if (this._global.subsystems.hasOwnProperty(sub)) {
                const element = this._global.subsystems[sub];
                subsystems[sub] = {};
                if (fillSubsystem && labelSubsystem === sub) {
                    const items = {};
                    this.fillObject(element.object, items);
                    subsystems[sub].object = items;
                    const parentSubsystem = this._global.subsystems[labelSubsystem];
                    subsystems[sub].subsystems =
                        parentSubsystem.subsystems.length > 0
                            ? this.getSubsystems(labelSubsystem)
                            : [];
                }
            }
        }
        return subsystems;
    }

    private fillObject(element, items) {
        const humanMeta = {
            CommonModule: "ОбщиеМодули",
            ExchangePlan: "ПланыОбмена",
            SettingsStorages: "ХранилищаНастроек",
            Constant: "Константы",
            Catalog: "Справочники",
            Document: "Документы",
            DocumentJournal: "ЖурналыДокумента",
            Enum: "Перечисления",
            Report: "Отчеты",
            DataProcessor: "Обработки",
            ChartsOfCharacteristicTypes: "ПланыВидовХарактеристик",
            ChartsOfAccounts: "ПланыСчетов",
            ChartsOfCalculationTypes: "ПланыВидовРасчета",
            InformationRegisters: "РегистрыСведений",
            AccumulationRegisters: "РегистрыНакопления",
            AccountingRegisters: "РегистрыБухгалтерии",
            CalculationRegisters: "РегистрыРасчета",
            BusinessProcesses: "БизнесПроцессы",
            Tasks: "Задачи"
        };
        for (const el of element) {
            const humanMetadata = humanMeta[el.split(".")[0]];
            if (!humanMetadata) {
                continue;
            }
            let humanModule = `${humanMetadata}.${el.split(".")[1]}`;
            humanModule = humanModule.replace("ОбщиеМодули.", "");
            const exportMethods = this._global.db.find({
                isExport: true,
                module: humanModule
            });
            if (exportMethods.length > 0) {
                this.fillExportMethods(items, exportMethods);
            }
        }
    }

    private fillExportMethods(items, exportMethods) {
        function compareMethods(a, b) {
            if (a.name > b.name) {
                return 1;
            }
            if (a.name < b.name) {
                return -1;
            }
        }
        exportMethods = exportMethods.sort(compareMethods);
        for (const expMethod of exportMethods) {
            if (!items[expMethod.module]) {
                items[expMethod.module] = {
                    name: expMethod.module
                };
            }
            const moduleDesc = items[expMethod.module];
            const isManager = expMethod.filename.endsWith("ManagerModule.bsl");
            const segment = isManager ? "manager" : "object";
            if (!moduleDesc[segment]) {
                moduleDesc[segment] = {};
            }
            const signature = this._global.GetSignature(expMethod);
            const regExpParams = new RegExp("^\\s*(Параметры|Parameters)\\:?s*\n*((.|\\n)*)", "gm");
            const paramsDesc = regExpParams.exec(signature.description);
            let strParamsDesc = "";
            if (paramsDesc) {
                strParamsDesc = paramsDesc[2];
                signature.description = signature.description.substr(0, paramsDesc.index);
            }
            const returnData = signature.fullRetState
                .substring(25)
                .replace(/((.|\n)*.+)\n*/m, "$1")
                .replace(/\n/g, "<br>")
                .replace(/\t/g, "");
            moduleDesc[segment][expMethod.name] = {
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
    }

    private getSubsystems(label) {
        const searchPattern = `Subsystems/${label}/**/Subsystems/*.xml`;
        const globOptions: glob.IOptions = {};
        globOptions.dot = true;
        globOptions.cwd = vscode.workspace.workspaceFolders[0].uri.fsPath;
        globOptions.nocase = true;
        globOptions.absolute = true;
        const files = glob.sync(searchPattern, globOptions);
        const subs = this.addSubsystems(files);
        return subs;
    }

    private addSubsystems(files) {
        const subsystems = [];
        const filesLength = files.length;
        const substrIndex = process.platform === "win32" ? 8 : 7;
        for (let i = 0; i < filesLength; ++i) {
            const data = this._global.readFileSync(files[i].toString(), substrIndex);
            let result;
            try {
                result = fastXmlParser.parse(data);
            } catch (err) {
                if (err) {
                    console.log(err);
                    continue;
                }
            }
            const propSubsys = result.MetaDataObject.Subsystem.Properties;
            const content =
                propSubsys.Content.length === 0 || !propSubsys.Content.hasOwnProperty("xr:Item")
                    ? []
                    : propSubsys.Content["xr:Item"];
            const items = {};
            this.fillObject(content, items);
            const item = {
                name: propSubsys.Name,
                content: items,
                subsystems: propSubsys.ChildObjects ? propSubsys.ChildObjects.Subsystem : []
            };
            subsystems.push(item);
        }
        return subsystems;
    }

    private buildHTMLDocument(updateContent): Promise<string> {
        let textSyntax = "";
        const metadata =
            this.syntax === "BSL"
                ? this.createListMd(this._global.methodForDescription.label)
                : undefined;
        const subsystems =
            this.syntax === "BSL"
                ? this.createListSubsystems(this._global.methodForDescription.label)
                : undefined;
        if (
            this._global.syntaxFilled === "" ||
            this._global.syntaxFilled !== this.syntax ||
            updateContent 
        ) {
            this._global.syntaxFilled = this.syntax;
            this.oscriptMethods = this.syntaxContent.getSyntaxContentItems(
                this.syntax === "BSL"
                    ? subsystems
                    : this.syntax === "Внешний СП"
                    ? this._global.syntaxHelpersData
                    : this._global.dllData,
                this.syntax === "BSL" ? metadata : this._global.libData
            );
            const jsonString = this.prepareJson(JSON.stringify(this.oscriptMethods));
            textSyntax = ` window.bsl_language='${jsonString}';
            `;

            const jsonLibData = this.prepareJson(JSON.stringify(this._global.contentData));
            textSyntax += ` window.os_library_data='${jsonLibData}';
            `;
        }

        this.syntaxContent.syntaxFilled = this._global.syntaxFilled;

        const syntaxObject = this._global.methodForDescription;
        this._global.methodForDescription = undefined;

        const fillStructure = this.getFillStructure(textSyntax, syntaxObject, subsystems, metadata);

        return this.getHTML(fillStructure);
    }

    private getFillStructure(textSyntax, syntaxObject, subsystems, metadata) {
        return this.syntaxContent.getStructure(
            textSyntax,
            this.syntax === "BSL"
                ? subsystems
                : this.syntax === "oscript-library"
                ? this._global.dllData
                : syntaxObject,
            this.syntax === "BSL"
                ? metadata
                : this.syntax === "oscript-library"
                ? this._global.libData
                : this.syntax === "Внешний СП"
                ? this._global.syntaxHelpersData
                : this.oscriptMethods
        );
    }

    private async getHTML(fillStructure): Promise<string> {
        
        let hljs = this.webPanel.webview.asWebviewUri(this.getUriForAsset('highlight.pack.js'));
        let mdit = this.webPanel.webview.asWebviewUri(this.getUriForAsset('markdown-it.js'));
        let shjs = this.webPanel.webview.asWebviewUri(this.getUriForAsset('syntaxhelper.js'));
        let themecss = this.webPanel.webview.asWebviewUri(this.getUriForAsset('theme.css'));

        return `<head>
                <link rel="stylesheet" type="text/css" href="${themecss}">
                    <script>
                        (function() {
                            try {
                                ${fillStructure.textSyntax}
                            } catch (error) {
                                console.error(error);
                            }
                        })();
                    </script>
                    <script>
                        function fillDescription(elem) {
                            if (document.getElementById('cont').style.display === "none") {
                                document.getElementById('cont').style.display = "block";
                                document.getElementById('splitter1').style.display = "block";
                                document.getElementById('struct').style.height = "133px";
                            }
                            let contextData = JSON.parse(window.bsl_language);
                            var str = elem.innerHTML.replace(new RegExp('\\n[ ]*','gm'),'').split(" / ")[0];
                            var segment = contextData[str];
                            var segmentDescription = "";
                            if (segment["description"]) {
                                segmentDescription = "<p>"+segment["description"]+"</p>";
                            }
                            segmentDescription = fillSegmentData(
                                segmentDescription, segment, "methods", "Методы", "method");
                            segmentDescription = fillSegmentData(
                                segmentDescription, segment, "manager", "Методы модуля менеджера", "manager");
                            segmentDescription = fillSegmentData(
                                segmentDescription, segment, "object", "Методы модуля объекта", "object");
                            segmentDescription = fillSegmentData(
                                segmentDescription, segment, "properties", "Свойства", "property");
                            segmentDescription = fillSegmentData(
                                segmentDescription, segment, "constructors", "Конструкторы", "constructor");
                            segmentDescription = fillSegmentData(
                                segmentDescription, segment, "values", "Значения", "value");
                            document.getElementById('header').innerHTML = elem.innerHTML
                            + ((segment.oscriptLib) ? (" (" + segment.oscriptLib + ")") : "");
                            document.getElementById('el').innerHTML = segmentDescription;
                        }

                        function fillSegmentData(segmentDescription, segment, strSegment, headerSegment, nameID) {
                            if (segment[strSegment]) {
                                segmentDescription = segmentDescription
                                + "<h1 style='font-size: 1em;'>" + headerSegment + "</h1><ul>";
                                var counter = 0;
                                for (var elem in segment[strSegment]) {
                                    counter = counter + 1;
                                    var onlyOs = "";${fillStructure.onlyOs}
                                    var alias = (nameID === "constructor")
                                    ? "" : ((segment[strSegment][elem]["alias"]!=="")
                                    ?(" / " + segment[strSegment][elem]["alias"]):"");
                                    segmentDescription = segmentDescription + "<li><span class='a' id = "
                                    + "'" + nameID + counter + "' "
                                    + " onclick='fill(this)'>" + elem + alias + "</span>" + onlyOs + "</li>";
                                }
                                segmentDescription = segmentDescription+ "</ul>";
                            }
                            return segmentDescription;
                        }

                        function fill(elem) {
                            if (document.getElementById('contMethod').style.display === "none") {
                                document.getElementById('contMethod').style.display = "block";
                                document.getElementById('splitter2').style.display = "block";
                                document.getElementById('el').style.height = "120px";
                            }
                            var strSegment = document.getElementById('header').innerHTML.replace(
                                new RegExp('\\n[ ]*','m'),'').split(" / ")[0].replace(new RegExp(' \\\\(.*\\\\)'),'');
                            var str = elem.innerHTML.replace(new RegExp('\\n[ ]*','m'),'').split(" / ")[0];
                            var charSegment = "";
                            if (elem.id.slice(0,6)==="method"){
                                charSegment = "methods";
                            } else if (elem.id.slice(0,8)==="property"){
                                charSegment = "properties";
                            } else if (elem.id.slice(0,6)==="object"){
                                charSegment = "object";
                            } else if (elem.id.slice(0,7)==="manager"){
                                charSegment = "manager";
                            } else if (elem.id.slice(0,11)==="constructor"){
                                charSegment = "constructors";
                            } else if (elem.id.slice(0,5)==="value"){
                                charSegment = "values";
                            }
                            let methodData =
                            JSON.parse(window.bsl_language)[strSegment][charSegment][str];
                            var depp = "";
                            if (charSegment === "constructors") {
                                str = strSegment.replace(', класс', '');
                            }
                            depp = fillDescriptionData(
                                methodData, depp, "description", "signature", "returns", str, charSegment);
                            document.getElementById('headerMethod').innerHTML = elem.innerHTML;
                            if (!methodData.description1C&&!methodData["Параметры1С"]){
                                document.getElementById('desc').innerHTML = "Только для OneScript";
                                } else {
                                document.getElementById('desc').innerHTML =
                                "Описание OneScript<br/>(<span class='a' id = '" + charSegment
                                + "' onclick='switchDescription(this)' style='font-size:1em'>переключить</span>)";
                                }
                            document.getElementById('elMethod').innerHTML = depp;
                        }
                        
                    </script>
                    <script type="text/javascript" src="${hljs}"></script>
                    <script type="text/javascript" src="${mdit}"></script>
                    <script type="text/javascript" src="${shjs}"></script>
                    <script>;
                    var defaults = {
                        highlight: function (str, lang) {
                            if (lang && hljs.getLanguage(lang)) {
                                try {
                                    return '<pre class="hljs"><code>' +
                                       hljs.highlight(lang, str, true).value +
                                       '</code></pre>';
                                } catch (__) {
                                }
                            }
                            return '<pre><code>'
                            + escapeHtml(str) + '</code></pre>';
                          }
                      };</script>
                    </head>
                    <body onload = "var md = window.markdownit(defaults);">
                    <h1 id="hjh">${fillStructure.globalHeader}</h1>
                    <a id="search" href="command:language-1c-bsl.syntaxHelper">               
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
                            <path d="M15.7 13.3l-3.81-3.83A5.93 5.93 0 0 0 13
                            6c0-3.31-2.69-6-6-6S1 2.69 1 6s2.69 6 6 6c1.3 0 2.48-.41 3.47-1.11l3.83 3.81c.19.2.45.3.7.3.25 0
                            .52-.09.7-.3a.996.996 0 0 0 0-1.41v.01zM7 10.7c-2.59 0-4.7-2.11-4.7-4.7 0-2.59 2.11-4.7 4.7-4.7
                            2.59 0 4.7 2.11 4.7 4.7 0 2.59-2.11 4.7-4.7 4.7z" fill="white"/>
                        </svg>
                        Поиск
                    </a>
                    <hr>
                    <div id = "struct" style="height:${fillStructure.menuHeight};">
                        ${fillStructure.globCont}
                        ${fillStructure.classes}</ul>
                    </div>
                    <div id = "splitter1" style = "display:${fillStructure.classVisible};" onmousedown="drag(this, event);"></div>
                    <div id="cont" style = "display:${fillStructure.classVisible};">
                        <h1 id="header">${fillStructure.segmentHeader}</h1>
                        <input type = "button" class = "button btn-close" value = "x" onclick = "closeCont();">
                        <hr>
                        <div id="el" style = "overflow-y: scroll; margin-left:5px; height: ${fillStructure.elHeight}">
                            ${fillStructure.segmentDescription}
                        </div>
                    <div id = "splitter2" style = "background: #9A9A9A; display:${
                        fillStructure.methodVisible
                    };
                    cursor: n-resize; height:2px; margin-top:4px;" onmousedown="drag(this, event);"></div>
                    <div id="contMethod" style = "display:${fillStructure.methodVisible};">
                        <div class="div-desc">
                        <h1 id="headerMethod">${fillStructure.methodHeader}</h1>
                        <span id = "desc" style='display:${fillStructure.displaySwitch}'>${fillStructure.switch1C}<\span>
                        </div>
                        <input type = "button" class = "button btn-close" value = "x" onclick = "closeMethod();">
                        <hr>
                        <div id="elMethod">
                            ${fillStructure.methodDescription}
                        </div>
                    </div>
                    </div>
                </body>`;
    }

    public getTilte(): string {
        return this.syntax;
    }

    private getUriForAsset(asset: string): vscode.Uri {
        let pathToAsset = path.join(
            vscode.extensions.getExtension("1c-syntax.language-1c-bsl").extensionPath,
            "lib",
            asset
        );
        return vscode.Uri.file(pathToAsset)
    }

    private prepareJson(value: string): string {
        return value
        .replace(/[\\]/g, "\\\\")
        .replace(/[\"]/g, '\\"')
        .replace(/[\']/g, "\\'")
        .replace(/[\/]/g, "\\/")
        .replace(/[\b]/g, "\\b")
        .replace(/[\f]/g, "\\f")
        .replace(/[\n]/g, "\\n")
        .replace(/[\r]/g, "\\r")
        .replace(/[\t]/g, "\\t");
    }
}
