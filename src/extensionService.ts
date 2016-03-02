"use strict";

import * as vscode from 'vscode';
import {IExtension, IExtensionVersion, listExtensions} from './galleryService';
import {some} from 'lodash';
import * as utils from './utils';
import * as semver from 'semver'
import * as os from 'os';
import * as path from 'path';

export default class ExtensionService {
    private extensionsPath: string = path.join(os.homedir(), '.vscode', 'extensions');

    listWantedExtensions(): Promise<string[]> {
        return Promise.resolve(vscode.workspace.getConfiguration('extension-manager').get<string[]>('extensions') || []);
    }

    listInstalledExtensions(): Promise<any[]> {
        return Promise.resolve(vscode.extensions.all.filter(e => e.extensionPath.startsWith(os.homedir())) || []);
    }

    listMissingExtensions(): Promise<string[]> {
        return Promise.all([this.listInstalledExtensions(), this.listWantedExtensions()]).then(results => {
            return results[1].filter(extId => !some(results[0], { 'id': extId}));
        })
    }

    installExtension(extension: IExtension) {
        return this.getLastValidVersion(extension, extension.versions).then(v => {
            const tempPath = path.join(os.tmpdir(), extension.metadata.id);
            const targetPath = path.join(this.extensionsPath, `${extension.publisher}.${extension.name}.${v.version}`);
            const packageJsonPath = path.join(targetPath, 'package.json');

            return utils.download(tempPath, v.downloadUri)
                .then(() => this.validate(tempPath, extension, v.version))
                .then(packageJson => utils.extractZipFile(tempPath, targetPath).then(() => packageJson))
                .then(packageJson => utils.writeMetadata(extension, v.version, packageJson, packageJsonPath));
        });
    }

    private validate(tempPath: string, extension: IExtension, version: string) {
        return utils.bufferZipFile(tempPath).then(buffer => {
            let packageJson = JSON.parse(buffer.toString('utf8'));
            if (extension) {
                if (extension.name !== packageJson.name) {
                    return Promise.reject(new Error('Invalid Extension: package.json name does not match request'));
                }
                if (extension.publisher !== packageJson.publisher) {
                    return Promise.reject(new Error('Invalid Extension: package.json publisher does not match request'));
                }
                if (version !== packageJson.version) {
                    return Promise.reject(new Error('Invalid Extension: package.json verions does not match request'))
                }
            }
            return Promise.resolve(packageJson);
        });
    }

    private getLastValidVersion(extension: IExtension, versions: IExtensionVersion[]): Promise<IExtensionVersion> {
        return new Promise<IExtensionVersion>((resolve, reject) => {
            if (versions.length === 0) {
                reject(new Error(`Couldn't find a compatible version of ${extension.publisher}.${extension.name} for this version of Code`))
            }
            const version = versions[0];
            utils.json(version.packageJsonUri).then(packageJson => {
                if (!semver.satisfies(vscode.version, packageJson.engines.vscode)) {
                    return this.getLastValidVersion(extension, versions.slice(1))
                }
                resolve(version);
            });
        });
    }
}