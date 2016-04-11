'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import ExtensionService from './extensionService';
import {listExtensions} from './galleryService';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    const extensionService = new ExtensionService(context);

    let installMissingExtensions = vscode.commands.registerCommand('webstp.extension-manager.installMissing', () => {
        extensionService.listMissingExtensions().then(extensions => {
            if (extensions.length === 0) {
                vscode.window.showInformationMessage("All extensions installed");
            }
            else {
                listExtensions(extensions).then(extensions => {
                    const total = extensions.length;
                    const promises: Promise<any>[] = [];
                    
                    extensions.forEach(e => {
                        promises.push(extensionService.installExtension(e));
                    });

                    Promise.all(promises).then(() => {
                        vscode.window.showInformationMessage(`Finished installing ${total} extensions`);
                    });
                });
            }
        });
    });
    
    context.subscriptions.push(installMissingExtensions);
}

// this method is called when your extension is deactivated
export function deactivate() {
}