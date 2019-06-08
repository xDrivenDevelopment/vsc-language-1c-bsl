import * as fs from "fs-extra";
import * as Paths from "path";
import * as vscode from "vscode";
import {
    Executable,
    LanguageClient,
    LanguageClientOptions,
    ServerOptions
} from "vscode-languageclient";
import * as which from "which";
import { BSL_MODE } from "./../const";

export default class LanguageClientProvider {
    public async registerLanguageClient(context: vscode.ExtensionContext) {
        const configuration = vscode.workspace.getConfiguration("language-1c-bsl");
        const languageServerEnabled = Boolean(configuration.get("languageServerEnabled"));

        if (!languageServerEnabled) {
            return;
        }

        let command = String(configuration.get("javaPath"));

        const javaInPath = which.sync(command, { nothrow: true });
        if (!javaInPath) {
            const javaPathExists = await fs.pathExists(command);
            if (!javaPathExists) {
                const errorMessage = `BSL Language Server is NOT running!\n
                Configuration error! Can't find "java" executable at: ${command}`;
                console.error(errorMessage);

                vscode.window.showErrorMessage(errorMessage);
                return;
            }
        }

        if (command.indexOf(" ") > 0) {
            command = `"${command}"`;
        }

        let languageServerPath = String(configuration.get("languageServerPath"));
        if (!Paths.isAbsolute(languageServerPath)) {
            languageServerPath = context.asAbsolutePath(languageServerPath);
        }
        if (languageServerPath.indexOf(" ") > 0) {
            languageServerPath = `"${languageServerPath}"`;
        }

        const javaOpts = Array(configuration.get("javaOpts"));

        const args: string[] = [];
        args.push(...javaOpts);
        args.push("-jar", languageServerPath);

        const rootPath = vscode.workspace.rootPath;
        if (rootPath) {
            const configurationFile = Paths.join(
                rootPath,
                String(configuration.get("languageServerConfiguration"))
            );

            args.push("-c", configurationFile);
        }

        const executable: Executable = {
            command,
            args,
            options: { env: process.env, stdio: "pipe", shell: true }
        };

        const serverOptions: ServerOptions = {
            run: executable,
            debug: executable
        };

        const clientOptions: LanguageClientOptions = {
            documentSelector: [
                { scheme: "file", language: BSL_MODE.toString() },
                { scheme: "untitled", language: BSL_MODE.toString() },
            ],
            synchronize: {
                fileEvents: vscode.workspace.createFileSystemWatcher("**/*.{os,bsl}")
            }
        };

        const client = new LanguageClient(
            "bsl-language-server",
            "BSL Language Server",
            serverOptions,
            clientOptions
        );

        const disposable = client.start();

        context.subscriptions.push(disposable);
    }
}
