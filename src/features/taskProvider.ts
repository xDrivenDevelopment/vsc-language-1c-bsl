import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

export default class TaskProvider {
    public onConfigurationChanged() {
        type AutoDetect = "on" | "off";
        const autoDetect = vscode.workspace
            .getConfiguration("language-1c-bsl")
            .get<AutoDetect>("autoDetect");
        if (!vscode.workspace.workspaceFolders) {
            return;
        }
        if (autoDetect === "on") {
            vscode.tasks.registerTaskProvider("bsl", {
                provideTasks: () => {
                    return this.provideBslScripts();
                },
                resolveTask(): vscode.Task | undefined {
                    return undefined;
                }
            });
        }
    }

    private provideBslScripts(): vscode.Task[] {
        const emptyTasks: vscode.Task[] = [];
        const allTasks: vscode.Task[] = [];
        const folders = vscode.workspace.workspaceFolders;

        if (!folders) {
            return emptyTasks;
        }

        try {
            for (const folder of folders) {
                if (
                    this.isEnabled(folder) &&
                    folder ===
                        vscode.workspace.getWorkspaceFolder(
                            vscode.window.activeTextEditor.document.uri
                        )
                ) {
                    allTasks.push(...this.fillDefaultTasks(folder.uri.fsPath));
                    const tasks = this.provideBslScriptsForFolder(folder.uri.fsPath);
                    allTasks.push(...tasks);
                }
            }
            return allTasks;
        } catch (error) {
            return error;
        }
    }

    private isEnabled(folder: vscode.WorkspaceFolder): boolean {
        return (
            vscode.workspace.getConfiguration("language-1c-bsl", folder.uri).get("autoDetect") ===
            "on"
        );
    }

    private fillDefaultTasks(workspaceRoot) {
        const result: vscode.Task[] = [];
        result.push(
            this.createTask(
                "OneScript: compile",
                workspaceRoot,
                // tslint:disable-next-line:no-invalid-template-strings
                "oscript",
                ["-compile", "${file}"],
                ["$OneScript Linter"]
            )
        );
        result.push(
            this.createTask(
                "OneScript: check",
                workspaceRoot,
                // tslint:disable-next-line:no-invalid-template-strings
                "oscript",
                ["-check", "${file}"],
                ["$OneScript Linter"]
            )
        );
        result.push(
            this.createTask(
                "OneScript: make",
                workspaceRoot,
                // tslint:disable-next-line:no-invalid-template-strings
                "oscript",
                ["-make", "${file}", "${fileBasename}.exe"],
                ["$OneScript Linter"]
            )
        );
        result.push(
            this.createTask(
                "OneScript: run",
                workspaceRoot,
                // tslint:disable-next-line:no-invalid-template-strings
                "oscript",
                ["${file}"],
                ["$OneScript Linter"],
                true
            )
        );
        result.push(
            this.createTask(
                "1testrunner: Testing project",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                ["1testrunner", "-runall", "${workspaceRoot}/tests"],
                ["$OneScript Linter"]
            )
        );
        result.push(
            this.createTask(
                "1testrunner: Testing current test-file",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                ["1testrunner", "-run", "${file}"],
                ["$OneScript Linter"],
                false,
                true
            )
        );
        result.push(
            this.createTask(
                "Opm: package build",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                ["opm", "build", "${workspaceRoot}"],
                ["$OneScript Linter"]
            )
        );
        result.push(
            this.createTask(
                "1bdd: Exec all features",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                ["1bdd", "${workspaceRoot}/features", "-out", "${workspaceRoot}/exec.log"],
                ["$OneScript Linter"],
                true
            )
        );
        result.push(
            this.createTask(
                "1bdd: Exec feature",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                ["1bdd", "${file}", "-fail-fast", "-require", "${workspaceRoot}/features", "-out", "${workspaceRoot}/exec.log"],
                ["$OneScript Linter"],
                false,
                true
            )
        );
        result.push(
            this.createTask(
                "1bdd: Exec feature for current step def",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                [
                    "1bdd",
                    "${fileDirname}/../${fileBasenameNoExtension}.feature",
                    "-fail-fast",
                    "-require",
                    "${workspaceRoot}/features",
                    "-out",
                    // tslint:disable-next-line:no-invalid-template-strings
                    "${workspaceRoot}/exec.log"
                ],
                ["$OneScript Linter"],
                false,
                true
            )
        );
        result.push(
            this.createTask(
                "1bdd: Exec feature + debug",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                [
                    "1bdd",
                    "${file}",
                    "-fail-fast",
                    "-require",
                    "${workspaceRoot}/features",
                    "-verbose",
                    "on",
                    "-out",
                    "${workspaceRoot}/exec.log"
                ],
                ["$OneScript Linter"]
            )
        );
        result.push(
            this.createTask(
                "1bdd: Generate feature steps",
                workspaceRoot,
                "cmd",
                // tslint:disable-next-line:no-invalid-template-strings
                ["1bdd", "gen", "${file}", "-out", "${workspaceRoot}/exec.log"],
                ["$OneScript Linter"]
            )
        );
        return result;
    }

    private createTask(
        label: string,
        workspaceRoot,
        command,
        args?: string[],
        problemMatcher?: string[],
        isBuildCommand = false,
        isTestCommand = false
    ): vscode.Task {
        const kind: vscode.TaskDefinition = {
            label,
            type: "bsl",
            args,
            problemMatcher
        };

        if (command === "cmd") {
            const isWin = /^win/.test(process.platform);
            command = isWin ? "cmd" : "sh";
            const argsWin = args.slice();
            const argsLin = args.slice();
            args.unshift(isWin ? "/c" : "-c");
            argsWin.unshift("/c");
            argsLin.unshift("-c");
            kind.windows = {
                command: "cmd",
                args: argsWin
            };
            kind.linux = {
                command: "sh",
                args: argsLin
            };
        } else {
            kind.command = command;
        }

        const task = new vscode.Task(
            kind,
            vscode.workspace.getWorkspaceFolder(vscode.window.activeTextEditor.document.uri),
            label,
            command,
            new vscode.ProcessExecution(command, args, { cwd: workspaceRoot }),
            problemMatcher
        );

        if (isBuildCommand) {
            task.group = vscode.TaskGroup.Build;
        }
        if (isTestCommand) {
            task.group = vscode.TaskGroup.Test;
        }

        // task.detail = `${command} ${args.join(" ")}` ;

        return task;
    }

    private provideBslScriptsForFolder(workspaceRoot: string): vscode.Task[] {
        const emptyTasks: vscode.Task[] = [];
        const tasksFolder = path.join(workspaceRoot, "tasks");

        if (!fs.existsSync(tasksFolder)) {
            return emptyTasks;
        }

        try {
            const result: vscode.Task[] = [];
            const taskFiles = fs.readdirSync(tasksFolder);
            for (const taskFile of taskFiles) {
                const filename = path.join(tasksFolder, taskFile);
                const stat = fs.lstatSync(filename);
                if (stat.isDirectory()) {
                    continue;
                }
                const label = taskFile;
                result.push(
                    this.createTask(
                        "Execute task: " + label,
                        // tslint:disable-next-line:no-invalid-template-strings
                        workspaceRoot,
                        "cmd",
                        ["oscript", "${workspaceRoot}/tasks/" + label],
                        ["$OneScript Linter"],
                        true
                    )
                );
            }
            return result;
        } catch (e) {
            return emptyTasks;
        }
    }
}
