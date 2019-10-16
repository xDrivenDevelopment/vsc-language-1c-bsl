import { Location, Range } from "vscode";

export interface IFunctionCallObject {
    functionName: string;
    calleeCallee: boolean;
    lineNumber: number;
    functionRange?: Range;
    paramNames?: string[];
    paramLocations?: Range[];
    definitionLocation?: Location;
}
