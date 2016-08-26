import { Query, Flags, FilterType } from  '../utils/galleryQuery';
import * as vscode from 'vscode'
import { request, asJson, IRequestOptions, IRequestContext, download } from '../utils/request';
import { isValidExtensionVersion } from '../utils/extensionValidator';
import * as path from 'path';
import { tmpdir } from 'os';
import * as url from 'url';

interface IRawGalleryExtension {
	displayName: string;
	extensionId: string;
	extensionName: string;
	shortDescription: string;
	publisher: { 
        displayName: string,
        publisherId: string,
        publisherName: string; 
    };
	versions?: IRawGalleryExtensionVersion[];
}

interface IRawGalleryExtensionVersion {
	version: string;
	lastUpdated: string;
	assetUri: string;
	files: IRawGalleryExtensionFile[];
}

interface IRawGalleryExtensionFile {
	assetType: string;
	source: string;
}

interface IRawGalleryQueryResult {
	results: {
		extensions: IRawGalleryExtension[];
	}[];
}

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

const AssetType = {
	Icon: 'Microsoft.VisualStudio.Services.Icons.Default',
	Details: 'Microsoft.VisualStudio.Services.Content.Details',
	Manifest: 'Microsoft.VisualStudio.Code.Manifest',
	VSIX: 'Microsoft.VisualStudio.Services.VSIXPackage',
	License: 'Microsoft.VisualStudio.Services.Content.License'
};

function getAssetSource(files: IRawGalleryExtensionFile[], type: string): string {
	const result = files.filter(f => f.assetType === type)[0];
	return result && result.source;
};

interface IDownloadedExtension {
    extension: IRawGalleryExtension;
    version: IRawGalleryExtensionVersion;
    zipPath: string;
};

export class ExtensionGallery {
    private extensionGalleryUrl = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

    download(extensionName: string): Promise<IDownloadedExtension> {
		const query = new Query()
			.withFlags(Flags.IncludeVersions, Flags.IncludeFiles)
			.withFilter(FilterType.Target, 'Microsoft.VisualStudio.Code')
			.withAssetTypes(AssetType.Manifest, AssetType.VSIX)
			.withFilter(FilterType.ExtensionName, extensionName);

		return this.queryGallery(query).then(galleryExtensions => {
            const [extension] = galleryExtensions;

            if (!extension) { 
                return Promise.reject<IDownloadedExtension>(new Error("Extension not found"));
            }
                
            return this.getLastValidExtensionVersion(extension, extension.versions)
                .then(version => {
                    const url = `${getAssetSource(version.files, AssetType.VSIX)}?install=true`;
                    const zipPath = path.join(tmpdir(), extension.extensionId);
                    const headers = this.commonHeaders();

                    return this._getAsset({headers, url})
                        .then(context => download(zipPath, context))
                        .then(() => ({ extension, version, zipPath }));
                });
            });
	}

    private queryGallery(query: Query): Promise<IRawGalleryExtension[]> {
        const data = JSON.stringify(query.raw);
        const headers = Object.assign(this.commonHeaders(), {
            'Content-Type': 'application/json',
            'Accept': 'application/json;api-version=3.0-preview.1',
            'Accept-Encoding': 'gzip',
            'Content-Length': data.length
        });

        return request({ type: 'POST', url: this.extensionGalleryUrl, data, headers })
            .then(context => asJson<IRawGalleryQueryResult>(context))
            .then(result => result.results[0].extensions);
	}

    private getLastValidExtensionVersion(extension: IRawGalleryExtension, versions: IRawGalleryExtensionVersion[]): Promise<IRawGalleryExtensionVersion> {
        if (!versions.length) {
            return Promise.reject<IRawGalleryExtensionVersion>(new Error(`Couldn't find a compatible version of ${extension.displayName || extension.extensionName} with this version of Code.`));
        }

        const latestValidVersion = versions[0];
        const url = getAssetSource(latestValidVersion.files, AssetType.Manifest);
        const headers = Object.assign(this.commonHeaders(), {
            'Accept-Encoding': 'gzip'
        });

        return request({ url, headers })
            .then(context => asJson<IExtensionManifest>(context))
            .then(manifest => {
                const desc = {
                    isBuiltin: false,
                    engines: { vscode: manifest.engines.vscode },
                    main: manifest.main
                };

                if (!isValidExtensionVersion(vscode.version, desc, [])) {
                    return this.getLastValidExtensionVersion(extension, versions.slice(1));
                }
                return latestValidVersion;
            });
	}

    private _getAsset(options: IRequestOptions): Promise<IRequestContext> {
		const parsedUrl = url.parse(options.url, true);
		parsedUrl.search = undefined;
		parsedUrl.query['redirect'] = 'true';

		const cdnUrl = url.format(parsedUrl);

		return request(Object.assign({}, options, { url: cdnUrl })).then(context => {
            if (context.res.statusCode !== 200) {
               return request(options);
            }
           return context;
        });
	}

    private commonHeaders(): { [key: string]: string; } {
        const headers: { [key: string]: string; } = {
            'X-Market-Client-Id': `VSCode ${ vscode.version }`,
            'User-Agent': `VSCode ${ vscode.version }`
        };

        if (vscode.env.machineId) {
            headers['X-Market-User-Id'] = vscode.env.machineId;
        }

        return headers;
	}
}