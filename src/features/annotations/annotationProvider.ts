import { DecorationInstanceRenderOptions, DecorationOptions, Range, ThemeColor, workspace } from "vscode";

export class Annotations {
  public static paramAnnotation(message: string, range: Range): DecorationOptions {

    // tslint:disable-next-line: no-object-literal-type-assertion
    return {
      range,
      // tslint:disable-next-line: no-object-literal-type-assertion
      renderOptions: {
        before: {
          color: new ThemeColor("language-1c-bsl.annotations.annotationForeground"),
          contentText: message,
          fontStyle: "italic",
          fontWeight: "400",
        }
      } as DecorationInstanceRenderOptions
    } as DecorationOptions;
  }

  public static errorParamAnnotation(range: Range): DecorationOptions {

    // tslint:disable-next-line: no-object-literal-type-assertion
    return {
      range,
      // tslint:disable-next-line: no-object-literal-type-assertion
      renderOptions: {
        before: {
          color: "red",
          contentText: "❗️ Invalid parameter: ",
          fontWeight: "800"
        }
      } as DecorationInstanceRenderOptions
    } as DecorationOptions;
  }
}
