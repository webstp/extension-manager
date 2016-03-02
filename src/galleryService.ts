import {json} from './utils'

const galleryAPI: string = 'https://marketplace.visualstudio.com/_apis/public/gallery/extensionquery';

export interface IExtensionMetadata {
    galleryApiUrl: string;
    id: string;
    downloadUrl: string;
    publisherId: string;
    publisherDisplayName: string;
    date: string;
}

export interface IExtensionVersion {
    version: string,
    date: string,
    downloadUri: string,
    packageJsonUri: string
}

export interface IExtension {
    name: string,
    publisher: string,
    versions: any[],
    metadata: IExtensionMetadata
}

export function listExtensions(extensions?: string[]): Promise<IExtension[]> {
    return queryGallery(extensions)
        .then(extensions => {
            return extensions.map(e => {
                const versions: IExtensionVersion[] = e.versions.map(v => ({
                    version: v.version,
                    date: v.lastUpdated,
                    downloadUri: `${v.assetUri}/Microsoft.VisualStudio.Services.VSIXPackage?install=true`,
                    packageJsonUri: `${v.assetUri}/Microsoft.VisualStudio.Code.Manifest`
                }));

                return {
                    name: e.extensionName,
                    displayName: e.displayName,
                    publisher: e.publisher.publisherName,
                    versions,
                    metadata: {
                        galleryApiUrl: galleryAPI,
                        id: e.extensionId,
                        downloadUrl: versions[0].downloadUri || undefined,
                        publisherId: e.publisher.publisherId,
                        publisherDisplayName: e.publisher.displayName,
                        installCount: getInstallCount(e.statistics),
                        date: e.lastUpdated
                    }

                }
            })
        });
}

function getInstallCount(stats: ExtensionStat[]): number {
    if (!stats) {
        return 0;
    }

    const stat = stats.filter(s => s.statisticName === 'install')[0];
    return stat ? stat.value : 0;
}

function queryGallery(extensions?: string[]): Promise<GalleryExtension[]> {
    const headers = {
        'Accept': 'application/json; api-version=3.0-preview.1',
    }
    let data = {
        filters: [{
            criteria: [{
                filterType: 8, //Installation Target
                value: 'Microsoft.VisualStudio.Code'
            }]
        }],
        flags: 389
    };

    if (extensions) {
        extensions.forEach(e => {
            data.filters[0].criteria.push({
                filterType: 7,
                value: e
            });
        });
    }


    return json(galleryAPI, 'POST', JSON.stringify(data), headers)
        .then(res => res.results[0].extensions);
}

interface ExtensionVerion {
    version: string,
    flags: string,
    lastUpdated: string,
    assetUri: string
}

interface ExtensionStat {
    statisticName: string,
    value: number
}

interface GalleryExtension {
    "publisher": { "publisherId": string, "publisherName": string, "displayName": string, "flags": string },
    "extensionId": string,
    "extensionName": string,
    "displayName": string,
    "flags": string,
    "lastUpdated": string,
    "publishedDate": string,
    "shortDescription": string,
    "versions": ExtensionVerion[],
    "categories": string[],
    "tags": string[],
    "statistics": ExtensionStat[]
}