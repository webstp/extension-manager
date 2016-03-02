import * as vscode from 'vscode';
import {parse as parseUrl} from 'url';
import {isBoolean, get, find} from 'lodash';
import * as http from 'http';
import * as https from 'https';
import HttpsProxyAgent = require('https-proxy-agent');
import HttpProxyAgent = require('http-proxy-agent');
import * as fs from 'fs';
import {open, ZipFile, Entry} from 'yauzl';
import {Readable} from 'stream';
import * as rimraf from 'rimraf';
import * as path from 'path';
import {IExtension} from './galleryService';

function request(url: string, method?: string, data?: string, headers?, redirects?: number): Promise<any> {
    return new Promise((resolve, reject) => {
        const endpoint = parseUrl(url);
        const strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL');
        const opts: https.RequestOptions = {
            hostname: endpoint.hostname,
            port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
            path: endpoint.path,
            headers,
            method: method || 'GET',
            agent: getProxyAgent(endpoint.protocol),
            rejectUnauthorized: isBoolean(strictSSL) ? strictSSL : true
        };
        const protocol = endpoint.protocol === 'https:' ? https : http;
        const req = protocol.request(opts, (res: http.ClientResponse) => {
            resolve({req, res});
        });
        req.on('error', reject);

        if (data) {
            req.write(data)
        }

        req.end();
    });
}

export function json(url: string, method?: string, data?: string, headers?): Promise<any> {
    Object.assign(headers || {}, {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
    });
    return request(url, method, data, headers).then(({req, res}) => new Promise((resolve, reject) => {
        if (res.statusCode !== 200) {
            reject(`Server responded with ${res.statusCode}`);
        }
        if (res.statusCode === 204) {
            resolve(undefined);
        }
        if (!/application\/json/.test(res.headers['content-type'])) {
            reject('Response doesn\'t appear to be JSON');
        }

        let buffer: string[] = [];
        res.on('data', chunk => buffer.push(chunk));
        res.on('end', () => resolve(JSON.parse(buffer.join(''))));
        res.on('error', reject);
    }));
}

export function download(filepath: string, url: string) {
    return request(url, undefined, undefined, undefined, 3).then(({req, res}) => new Promise<void>((resolve, reject) => {
        const out = fs.createWriteStream(filepath);

        out.once('finish', () => resolve(undefined));
        res.once('error', reject);
        res.pipe(out);
    }));
}

export function getProxyAgent(protocol: string) {
    const rawProxyUrl = getProxyURI(protocol);
    const strictSSL = vscode.workspace.getConfiguration('http').get('proxyStrictSSL');

    if (!rawProxyUrl) {
        return null;
    }

    const proxyUrl = parseUrl(rawProxyUrl);
    const options = {
        host: proxyUrl.hostname,
        port: proxyUrl.port,
        auth: proxyUrl.auth,
        rejectUnauthorized: isBoolean(strictSSL) ? strictSSL : true
    }
    return protocol === 'http:' ? new HttpProxyAgent(options) : new HttpsProxyAgent(options);
}

function getProxyURI(protocol: string) {
    if (protocol === 'http:') {
        return vscode.workspace.getConfiguration('http').get('proxy') || process.env.HTTP_PROXY || process.env.http_proxy || null;
    }
    else if (protocol === 'https:') {
        return process.env.HTTPS_PROXY || process.env.https_proxy || vscode.workspace.getConfiguration('http').get('proxy') || process.env.HTTP_PROXY || process.env.http_proxy || null;
    }
    return null
}

export function writeMetadata(extension: IExtension, version: any, packageJson: any, packageJsonPath: string) {
    packageJson = Object.assign({__metadata: extension.metadata}, packageJson)
    return new Promise((resolve, reject) => {
        fs.writeFile(packageJsonPath, JSON.stringify(packageJson), err => err ? reject(err) : resolve());
    });
}

export function extractZipFile(zipPath: string, targetPath: string): Promise<any> {
    const sourcePathRegex = new RegExp('^extension');
    
    return new Promise<ZipFile>((resolve, reject) => {
        open(zipPath, (err, zipFile) => err ? reject(err) : resolve(zipFile));
    })
    .then<ZipFile>(zipFile => new Promise<ZipFile>((resolve, reject) => {
        rimraf(targetPath, reject);
        resolve(zipFile);
    }))
    .then(zipFile => {
        return new Promise((resolve, reject) => {
            const promises: Promise<any>[] = [];
            zipFile.once('error', reject);
            zipFile.on('entry', (entry: Entry) => {
                if (!sourcePathRegex.test(entry.fileName)) {
                    return;
                }
                
                promises.push(extractEntry(zipFile, entry, targetPath, sourcePathRegex));
            });
            zipFile.on('close', () => Promise.all(promises).then(resolve, reject));
        });
    });
}

function extractEntry(zipFile: ZipFile, entry: Entry, targetPath: string, sourcePathRegex: RegExp): Promise<any> {
    const fileName = entry.fileName.replace(sourcePathRegex, '');
	const dirName = path.dirname(fileName);
	const targetDirName = path.join(targetPath, dirName);
	const targetFileName = path.join(targetPath, fileName);
	const mode = modeFromEntry(entry);
    
    return new Promise<Readable>((resolve, reject) => {
        zipFile.openReadStream(entry, (err, stream) => err ? reject(err) : resolve(stream));
    })
    .then(readStream => new Promise((resolve, reject) =>  {
        mkdir(targetDirName).then(() => {
            let writeStream: any = fs.createWriteStream(targetFileName, {mode});
            writeStream.once('error', reject);
            writeStream.once('finish', resolve);
            readStream.once('error', reject);
            readStream.pipe(writeStream);
        });
    }));
}

function mkdir(targetPath: string) {
    const makeDir = () => new Promise((resolve, reject) => {
        fs.mkdir(targetPath, err => err ? reject(err) : resolve())
    }).then(() => {}, (err: NodeJS.ErrnoException) => {
        if (err.code === 'EEXIST') {
            return new Promise<fs.Stats>((resolve, reject) => {
                fs.stat(targetPath, (err, stats) => err ? reject(err) : resolve(stats))
            }).then(stat =>  stat.isDirectory ? undefined : Promise.reject(new Error(`${path} exists and is not a directory`)));
        }
        return Promise.reject(err);
    })
    
    if (targetPath === path.dirname(targetPath)) {
        return Promise.resolve(true)
    }
    
    return makeDir().then(undefined, (err: NodeJS.ErrnoException) => {
        if (err.code === 'ENOENT') {
            return mkdir(path.dirname(targetPath)).then(makeDir);
        }
        
        return Promise.reject(err);
    })
}

function modeFromEntry(entry: Entry) {
	let attr = entry.externalFileAttributes >> 16 || 33188;

	return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
		.map(mask => attr & mask)
		.reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
}

export function bufferZipFile(zipPath: string): Promise<Buffer> {
    return readZipFile(zipPath).then(stream => new Promise((resolve, reject) => {
        const buffers = [];
        stream.once('error', reject);
        stream.on('data', chunk => buffers.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(buffers)));
    }));
}

function readZipFile(zipPath: string): Promise<Readable> {
    return new Promise<ZipFile>((resolve, reject) => {
        open(zipPath, (err, zipFile) => err ? reject(err) : resolve(zipFile));
    }).then(zipFile => new Promise((resolve, reject) => {
        zipFile.on('entry', (entry: Entry) => {
           if(entry.fileName === 'extension/package.json') {
               zipFile.openReadStream(entry, (err, stream) => {
                  if (err) {
                      reject(err);
                  }
                  resolve(stream)
               });
           } 
        });
        zipFile.once('close', () => reject(new Error('"extension/package.json" no found in zip')));
    }));
}
