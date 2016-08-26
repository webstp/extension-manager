import { ExtensionContext, extensions, workspace } from 'vscode';
import * as path from 'path';
import { some } from 'lodash';
import { ExtensionGallery } from './extensionGallery';
import { extract } from '../utils/zip';
import * as fs from 'fs';

interface IExtensionManifest {
	name: string;
	publisher: string;
	version: string;
	engines: { vscode: string };
	displayName?: string;
	description?: string;
	main?: string;
	icon?: string;
}

interface IGalleryMetadata {
	id: string;
	publisherId: string;
	publisherDisplayName: string;
}

export class ExtensionManager {
    private extensionPath: string;
    private gallery: ExtensionGallery;

    constructor(ctx: ExtensionContext) {
        this.extensionPath = path.dirname(ctx.extensionPath);
        this.gallery = new ExtensionGallery();
    }

    private listLocalExtensions() {
        return extensions.all.filter(e => path.dirname(e.extensionPath) === this.extensionPath);
    }

    private listRequiredExtensions() {
        return workspace.getConfiguration('extension-manager').get<string[]>('required', []);
    }

    missingRequiredExtensions() {
        return this.listRequiredExtensions().filter(extId => !some(this.listLocalExtensions(), { 'id': extId}));
    }

    installFromGallery(extensionName: string) {
        // return new Promise((resolve, reject) => {
        return this.gallery.download(extensionName).then(result => {
            let { extension, version, zipPath } = result;
            const metadata = {
                id: extension.extensionId,
                publisherId: extension.publisher.publisherId,
                publisherDisplayName: extension.publisher.displayName
            }

            return this.installExtension(zipPath, `${extensionName}-${version.version}`, metadata);
        })
    }

    private installExtension(zipPath: string, id: string, metadata: IGalleryMetadata) {
        const extensionPath = path.join(this.extensionPath, id);
        const manifestPath = path.join(extensionPath, 'package.json');

        return extract(zipPath, extensionPath, { sourcePath: 'extension', overwrite: true})
            .then(() => new Promise<string>((c, e) => {
                fs.readFile(manifestPath, 'utf8', (err, data) =>  err ? e(err) : c(data));
            }))
            .then(raw => parseManifest(raw))
            .then(({manifest}) => new Promise<void>((c, e) => {
                const newManifest = Object.assign(manifest, { __metadata: metadata });
                fs.writeFile(manifestPath, JSON.stringify(newManifest, null, '\t'), err => err ? e(err) : c());
            }));
    }
}

function parseManifest(raw: string): Promise<{ manifest: IExtensionManifest; metadata: IGalleryMetadata; }> {
	return new Promise((c, e) => {
		try {
			const manifest = JSON.parse(raw);
			const metadata = manifest.__metadata || null;
			delete manifest.__metadata;
			c({ manifest, metadata });
		} catch (err) {
			e(new Error("Extension invalid: package.json is not a JSON file."));
		}
	});
}