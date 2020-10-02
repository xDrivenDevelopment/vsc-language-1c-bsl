import * as path from "path";
import * as vscode from "vscode";

import AbstractSyntaxContent from "./AbstractSyntaxContent";

import LibProvider from "../libProvider";
const libProvider = new LibProvider();

export default class SyntaxContentOscriptLibrary extends AbstractSyntaxContent {
    public getSyntaxContentItems(globalDllData, libData): any {
        const items = {};
        for (const dll in globalDllData) {
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
        for (const lib in libData) {
            for (const modul in libData[lib].modules) {
                items[modul] = libData[lib].modules[modul];
                items[modul].oscriptLib = lib;
            }
        }

        return items;
    }

    public getStructure(textSyntax: string, dllData: object, libData: object): any {
        const fillStructure = {
            globalHeader: "Описание пакетов и библиотек oscript-library",
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
        const added = {};
        if (Object.keys(libData).length > 0) {
            classes = classes + "</ul><h1 style='font-size: 1em;'>Библиотеки</h1>";
            for (const lib in libData) {
                if (!dllData[lib] && lib != "OneScript.Web") {
                    const dataModul = libData[lib].modules;
                    if (libData[lib].description) {
                        classes += `<h2 class='a' style='font-size: 1em;' onclick="readContent('${lib}');">`;
                    } else {
                        classes += "<h2 style='font-size: 1em;'>";
                    }
                    classes += `<em>${lib}</em></h2> <ul>`;
                    for (const modul in dataModul) {
                        const onlyOs = "";
                        classes += `
                        <li>
                        <span class="a" onclick="fillDescription(this)">${modul}</span>
                        ${onlyOs}
                        </li>`;
                    }
                    classes += "</ul>";
                }
            }
        }
        if (Object.keys(dllData).length > 0) {
            classes =
                classes +
                "</ul><h1 style='font-size: 1em;'>Классы, добавляемые внешними компонентами</h1>";
            for (const classDll in dllData) {
                const defDll = dllData[classDll];
                if (dllData[classDll].description) {
                    classes += `<h2 class='a' style='font-size: 1em;' onclick="readContent('${classDll}');">`;
                } else {
                    classes += "<h2 style='font-size: 1em;'>";
                }
                classes += `<em>${classDll}</em></h2> <ul>`;

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
        fillStructure.globCont = "";
        fillStructure.classes = classes;
        return fillStructure;
    }
}
