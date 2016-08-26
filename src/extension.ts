'use strict';
import { ExtensionContext, window, StatusBarAlignment, MessageItem, commands, workspace } from 'vscode';
import { ExtensionManager } from './services/extensionManager';
import * as semver from 'semver';

export function activate(ctx: ExtensionContext) {
    const manager: ExtensionManager = new ExtensionManager(ctx);
    const statusItem = window.createStatusBarItem(StatusBarAlignment.Left);
    let autoInstall = workspace.getConfiguration('extension-manager').get('auto-install', true);
    const restartButton: MessageItem = {
        title: 'Restart Now',
        isCloseAffordance: true
    };
    const installButton: MessageItem = {
        title: 'Install'
    };

    function installMissingExtenstions(missingExtensions: string[]) {
        statusItem.show();
        let installedCount = 0;
        const installPromises = missingExtensions.map((extensionName, index, missing) => {
            statusItem.text = `$(cloud-download) Installing ${index+1} of ${missing.length} extensions`
            let installPromise = manager.installFromGallery(extensionName);
            return manager.installFromGallery(extensionName).then(() => {
                installedCount++;
            }, e => {
                window.showWarningMessage(`Failed to install '${extensionName}': ${e}`);
            });
        });

        Promise.all(installPromises).then(() => {
            statusItem.hide();
            if (installedCount === missingExtensions.length) {
                window.showInformationMessage(`Succesfully installed all required extensions.`, restartButton).then(() => {
                    commands.executeCommand('workbench.action.reloadWindow');
                });
            }
            else if(installedCount > 0) {
                window.showInformationMessage(`Succesfully installed ${installedCount} of ${missingExtensions.length} extensions.`, restartButton).then(() => {
                    commands.executeCommand('workbench.action.reloadWindow');
                });
            }
        });
    };

    if (autoInstall) {
        const missing = manager.missingRequiredExtensions();
        if (missing.length > 0) {
            const grammar = missing.length === 1 ? { verb: 'is', subject: 'extension' } : { verb: 'are', subject: 'extensions' };
            const msg = `There ${grammar.verb} ${missing.length} ${grammar.subject} that ${grammar.verb} marked as required. Installing will require a restart`
            window.showInformationMessage(msg, installButton).then(selected => {
                if (selected === installButton) {
                    installMissingExtenstions(missing);
                }
            })

        }
    }

    let installCommand = commands.registerCommand('webstp.extension-manager.installRequired', () => {
        const missing = manager.missingRequiredExtensions();
        if (missing.length > 0) {
            installMissingExtenstions(missing);
        }
    });
    
    ctx.subscriptions.push(installCommand);
}

// this method is called when your extension is deactivated
export function deactivate() {
}