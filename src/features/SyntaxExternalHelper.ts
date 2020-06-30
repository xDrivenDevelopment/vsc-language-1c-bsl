import * as path from "path";

import AbstractSyntaxContent from "./AbstractSyntaxContent";

import LibProvider from "../libProvider";
const libProvider = new LibProvider();

export default class SyntaxExternalHelper extends AbstractSyntaxContent {
    public getSyntaxContentItems(globalDllData, libData): any {
        const items = {};
        for (const dll in globalDllData) {
            const structureGlobContext = globalDllData[dll].structureMenu;
            const globalfunctions = globalDllData[dll].globalfunctions;
            for (const element in structureGlobContext.global) {
                if (element === "Обработчики событий") {
                    continue;
                }
                const segment = structureGlobContext.global[element];
                const segmentChar = {};
                for (const key in segment) {
                    let signature1C;
                    let description1C;
                    let returns1C;
                    if (globalfunctions[key]) {
                        // tslint:disable-next-line:no-string-literal
                        if (!segmentChar["methods"]) {
                            // tslint:disable-next-line:no-string-literal
                            segmentChar["methods"] = {};
                        }
                        const methodData = globalfunctions[key];
                        if (libProvider.bslglobals.globalfunctions[key]) {
                            signature1C = libProvider.bslglobals.globalfunctions[key].signature;
                            description1C = libProvider.bslglobals.globalfunctions[key].description;
                            returns1C = libProvider.bslglobals.globalfunctions[key].returns;
                        }
                        // tslint:disable-next-line:no-string-literal
                        segmentChar["methods"][key] = {
                            description: methodData.description ? methodData.description : "",
                            alias: methodData.name_en,
                            signature: methodData.signature,
                            returns: methodData.returns,
                            example: methodData.example,
                            signature1C,
                            description1C,
                            returns1C
                        };
                    } else {
                        // tslint:disable-next-line:no-string-literal
                        if (!segmentChar["properties"]) {
                            // tslint:disable-next-line:no-string-literal
                            segmentChar["properties"] = {};
                        }
                        const methodData = libProvider.oscriptStdLib.globalvariables[key];
                        if (libProvider.bslglobals.globalvariables[key]) {
                            description1C = libProvider.bslglobals.globalvariables[key].description;
                        }

                        // tslint:disable-next-line:no-string-literal
                        segmentChar["properties"][key] = {
                            description: methodData.description ? methodData.description : "",
                            alias: methodData.name_en,
                            Доступ: methodData.access,
                            signature: undefined,
                            returns: undefined,
                            description1C
                        };
                    }
                }
                items[element] = segmentChar;
            }

            for (const element in globalDllData[dll].classes) {
                const segment = globalDllData[dll].classes[element];
                const segmentChar = this.getSegmentData(
                    segment,
                    false,
                    "OneScript",
                    libProvider.bslglobals.classes[segment.name]
                );
                items[element] = segmentChar;
                items[element].oscriptLib = dll;
            }
        }

        return items;
    }

    public getStructure(textSyntax: string, dllData: object, libData: object): any {
        const fillStructure = {
            globalHeader: "Внешний СП для приложений OneScript",
            textSyntax,
            descClass: "",
            descMethod: "",
            menuHeight: "100%",
            elHeight: "100%",
            classVisible: "none",
            methodVisible: "none",
            segmentHeader: "OneScript",
            methodHeader: "OneScript",
            displaySwitch: "none",
            switch1C: "Только для OneScript",
            segmentDescription: "Очень много текста",
            methodDescription: "Очень много текста",
            onlyOs: ""
        };
        return this.fillStructureSyntax(fillStructure, dllData, libData);
    }

    private fillStructureSyntax(fillStructure, dllData, libData) {
        let classes = "";
        let globCont = "";
        const added = {};

        if (Object.keys(libData).length > 0) {
            for (const classDll in libData) {
                if (classDll === dllData.label) {
                    const defDll = libData[classDll];
                    if (libData[classDll].description) {
                        globCont += `<h2 class='a' style='font-size: 1em;' onclick="readContent('${classDll}');">`;
                    } else {
                        globCont += "<h2 style='font-size: 1em;'>";
                    }
                    globCont += `${classDll}</h2>`;
                    const structureGlobContext = defDll.structureMenu;
                    if (structureGlobContext.global) {
                        globCont =
                            globCont + "<h2 style='font-size: 1em;'>Глобальный контекст</h2><ul>";
                        for (const element in structureGlobContext.global) {
                            globCont =
                                globCont +
                                `<li><span class="a"
                            onclick="fillDescription(this)">${element}</span></li>`;
                        }
                        globCont = globCont + `</ul>`;
                    }

                    for (const segmentClass in structureGlobContext.classes) {
                        if (segmentClass === "Прочее") {
                            continue;
                        }
                        classes =
                            classes + "<h2 style='font-size: 1em;'>" + segmentClass + "</h2><ul>";
                        for (const currentClass in structureGlobContext.classes[segmentClass]) {
                            const onlyOs = !libProvider.bslglobals.classes[currentClass] ? "*" : "";
                            classes =
                                classes +
                                `<li><span class="a" onclick="fillDescription(this)">
                            ${currentClass +
                                " / " +
                                defDll.classes[currentClass].name_en}</span>${onlyOs}</li>`;
                            added[currentClass] = true;
                            if (structureGlobContext.classes[segmentClass][currentClass] !== "") {
                                classes = classes + "<ul>";
                                for (const childClass in structureGlobContext.classes[segmentClass][
                                    currentClass
                                ]) {
                                    added[childClass] = true;
                                    classes =
                                        classes +
                                        `<li><span class="a" onclick="fillDescription(this)">
                                    ${childClass +
                                        " / " +
                                        defDll.classes[childClass].name_en}</span></li>`;
                                }
                                classes = classes + "</ul>";
                            }
                        }
                        if (segmentClass !== "Прочее") {
                            classes = classes + "</ul>";
                        }
                    }
                    for (const element in defDll.classes) {
                        if (!added[element]) {
                            let onlyOs = "";
                            if (!libProvider.bslglobals.classes[element]) {
                                onlyOs = "*";
                            }
                            const alias =
                                defDll.classes[element].name_en !== ""
                                    ? " / " + defDll.classes[element].name_en
                                    : "";
                            classes =
                                classes +
                                `<li><span class="a" onclick="fillDescription(this)">
                            ${element + alias}</span>${onlyOs}</li>`;
                        }
                    }
                    classes = classes + "</ul>";
                }
            }
        }
        fillStructure.globCont = globCont;
        fillStructure.classes = classes;
        return fillStructure;
    }
}
