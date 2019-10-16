import * as vscode from "vscode";
import { Annotations } from "./annotationProvider";
import { IFunctionCallObject } from "./functionCallObject";
import { grabPossibleParameters } from "./paramExtractor";

export async function decorateFunctionCall(
      currentEditor: vscode.TextEditor,
      documentCache: any,
      decArray,
      errDecArray: vscode.DecorationOptions[],
      fc: IFunctionCallObject,
      diagnostics: vscode.Diagnostic[]
    ): Promise<void> {
  // Check for existence of functionCallObject and a defintion location
  if (fc === undefined || fc.definitionLocation === undefined) {
    return;
  }

  // configs for decorations
  const hideIfEqual = vscode.workspace.getConfiguration("language-1c-bsl.annotations")
    .get("hideIfEqual");
  const willShowDiagnostics = vscode.workspace.getConfiguration("language-1c-bsl.annotations")
    .get("hideDiagnostics") === false;
  const willShowErrorAnnotation = vscode.workspace.getConfiguration("language-1c-bsl.annotations")
    .get("hideInvalidAnnotation") === false;

  const document = await loadDefinitionDocument(fc.definitionLocation.uri, documentCache);
  const definitionLine = document.lineAt(fc.definitionLocation.range.start.line).text;

  let paramList = grabPossibleParameters(fc, definitionLine);

  // Remove first parameter from list if it equals `this` in a TS file
  if (currentEditor.document.languageId === "bsl" && paramList[0] === "this") {
    paramList = paramList.slice(1);
  }

  if (paramList.length > 0) {

    // Look to see if a param is a rest parameter (ex: console.log has a rest parameter called ...optionalParams)
    const restParamIdx = paramList.findIndex((item) => item.substr(0, 3) === "...");

    // If it exists, remove the triple dots at the beginning
    if (restParamIdx !== -1) {
      paramList[restParamIdx] = paramList[restParamIdx].slice(3);
    }

    if (fc.paramLocations && fc.paramNames) {
      let counter = 0;
      for (const ix in fc.paramLocations) {
        if (fc.paramLocations.hasOwnProperty(ix)) {
          const idx = parseInt(ix, 10);

          // skip when arg and param match and hideIfEqual config is on
          if (hideIfEqual && fc.paramNames[idx] === paramList[idx]) {
            counter++; // Still tick the counter even if skipping the annotation
            continue;
          }

          let decoration: vscode.DecorationOptions;

          const currentArgRange = fc.paramLocations[idx];

          if (restParamIdx !== -1 && idx >= restParamIdx) {
            decoration = Annotations.paramAnnotation(
              paramList[restParamIdx] + `[${idx - restParamIdx}]: `,
              currentArgRange
            );
          } else {
            if (idx >= paramList.length) {
              if (currentEditor.document.languageId === "bsl" && willShowDiagnostics) {
                const diag = new vscode.Diagnostic(
                  currentArgRange,
                  "[BSL Param Annotations] Invalid parameter",
                  vscode.DiagnosticSeverity.Error
                );

                if (!diagnostics) {
                  console.log(arguments);
                }

                // If the diagnostic does not exist in the array yet, push it
                if (!diagnostics.some((diagnostic) => JSON.stringify(diagnostic) === JSON.stringify(diag))) {
                  diagnostics.push(diag);
                }
              }

              if (willShowErrorAnnotation) {
                const errorDecoration = Annotations.errorParamAnnotation(currentArgRange);
                errDecArray.push(errorDecoration);
              }

              continue;
            }

            decoration = Annotations.paramAnnotation(paramList[idx] + ": ", currentArgRange);
          }
          counter++;
          decArray.push(decoration);
        }
      }
    }
  }
}

async function loadDefinitionDocument(uri: vscode.Uri, documentCache: any) {
  let document: vscode.TextDocument;

  // Currently index documentCache by the filename (TODO: Figure out better index later)
  const pathNameArr = uri.fsPath.split("/");
  const pathName = pathNameArr[pathNameArr.length - 2] + "/" + pathNameArr[pathNameArr.length - 1];

  // If the document is not present in the cache, load it from the filesystem, otherwise grab from the cache
  if (documentCache[pathName] === undefined) {
    document = await vscode.workspace.openTextDocument(uri);
    documentCache[pathName] = document;
  } else {
    document = documentCache[pathName];
  }

  return document;
}
