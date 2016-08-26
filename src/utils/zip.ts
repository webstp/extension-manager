import * as rimraf from 'rimraf';
import { open as openZip, Entry, ZipFile } from 'yauzl';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'stream';

export interface IExtractOptions {
	overwrite?: boolean;
	sourcePath?: string;
}

interface IOptions {
	sourcePathRegex: RegExp;
}

export function extract(zipPath: string, targetPath: string, options: IExtractOptions = {}) {
	const sourcePathRegex = new RegExp(options.sourcePath ? `^${ options.sourcePath }` : '');

	let promise = new Promise<ZipFile>((c, e) => {
        openZip(zipPath, (err, zipFile) => err ? e(err) : c(zipFile));
    });

	if (options.overwrite) {
		promise = promise.then(zipfile => new Promise((c, e) => {
            rimraf(targetPath, e);
            c(zipfile); 
        }));
	}

	return promise.then(zipfile => extractZip(zipfile, targetPath, { sourcePathRegex }));
}

export function buffer(zipPath: string, filePath: string): Promise<Buffer> {
	return read(zipPath, filePath).then(stream => {
		return new Promise<Buffer>((c, e) => {
			const buffers = [];
			stream.once('error', e);
			stream.on('data', b => buffers.push(b));
			stream.on('end', () => c(Buffer.concat(buffers)));
		});
	});
}

function read(zipPath: string, filePath: string): Promise<Readable> {
	return new Promise<ZipFile>((c, e) => {
        openZip(zipPath, (err, zipFile) => err ? e(err) : c(zipFile));
    }).then(zipfile => {
		return new Promise<Readable>((c, e) => {
			zipfile.on('entry', (entry: Entry) => {
				if (entry.fileName === filePath) {
                    zipfile.openReadStream(entry, (err, stream) => err ? e(err) : c(stream));
				}
			});

			zipfile.once('close', () => e(new Error(`${filePath} not found inside zip.`)));
		});
	});
}

function extractZip(zipfile: ZipFile, targetPath: string, options: IOptions) {
	return new Promise((resolve, reject) => {
        const promises: Promise<any>[] = [];

		zipfile.once('error', reject);
		zipfile.once('close', () => Promise.all(promises).then(resolve, reject));
		zipfile.on('entry', (entry: Entry) => {
			if (!options.sourcePathRegex.test(entry.fileName)) {
				return;
			}

			const fileName = entry.fileName.replace(options.sourcePathRegex, '');

			// directory file names end with '/'
			if (/\/$/.test(fileName)) {
				const targetFileName = path.join(targetPath, fileName);
				promises.push(mkdirp(targetFileName));
				return;
			}

			const stream = new Promise<Readable>((c, e) => {
                zipfile.openReadStream(entry, (err, stream) => err ? e(err) : c(stream));
            });
			const mode = modeFromEntry(entry);
            promises.push(stream.then(stream => extractEntry(stream, fileName, mode, targetPath, options)));
		});
	});
}

function modeFromEntry(entry: Entry) {
	let attr = entry.externalFileAttributes >> 16 || 33188;

	return [448 /* S_IRWXU */, 56 /* S_IRWXG */, 7 /* S_IRWXO */]
		.map(mask => attr & mask)
		.reduce((a, b) => a + b, attr & 61440 /* S_IFMT */);
}

function extractEntry(stream: Readable, fileName: string, mode: number, targetPath: string, options: IOptions): Promise<any> {
	const dirName = path.dirname(fileName);
	const targetDirName = path.join(targetPath, dirName);
	const targetFileName = path.join(targetPath, fileName);

    return mkdirp(targetDirName).then(() => new Promise((c, e) => {
		let istream = fs.createWriteStream(targetFileName, { mode });
		istream.once('finish', () => c());
		istream.once('error', e);
		stream.once('error', e);
		stream.pipe(istream);
	}));
}

function mkdirp(targetPath: string): Promise<any> {
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
            return mkdirp(path.dirname(targetPath)).then(makeDir);
        }
        
        return Promise.reject(err);
    })
}