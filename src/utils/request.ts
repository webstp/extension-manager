import https = require('https');
import http = require('http');
import { Stream } from 'stream';
import { parse as parseUrl } from 'url';
import { createWriteStream } from 'fs';
import { createGunzip } from 'zlib';
import { isBoolean, isNumber } from 'lodash';
import { getProxyAgent } from './proxy';
import { workspace } from 'vscode';

export type Agent = any;

export interface IRequestOptions {
	type?: string;
	url?: string;
	user?: string;
	password?: string;
	headers?: any;
	timeout?: number;
	data?: any;
	agent?: Agent;
	followRedirects?: number;
}

export interface IRequestContext {
	req: http.ClientRequest;
	res: http.ClientResponse;
	stream: Stream;
}

export function request(options: IRequestOptions): Promise<IRequestContext> {
	let req: http.ClientRequest;

	return new Promise<IRequestContext>((resolve, reject) => {
		const endpoint = parseUrl(options.url);
		const protocol = endpoint.protocol === 'https:' ? https : http;
        const strictSSL = workspace.getConfiguration('http').get('proxyStrictSSL');
		const opts: https.RequestOptions = {
			hostname: endpoint.hostname,
			port: endpoint.port ? parseInt(endpoint.port) : (endpoint.protocol === 'https:' ? 443 : 80),
			path: endpoint.path,
			method: options.type || 'GET',
			headers: options.headers,
			agent: getProxyAgent(endpoint.protocol),
            rejectUnauthorized: isBoolean(strictSSL) ? strictSSL : true
		};

		if (options.user && options.password) {
			opts.auth = options.user + ':' + options.password;
		}

		req = protocol.request(opts, (res: http.ClientResponse) => {
			const followRedirects = isNumber(options.followRedirects) ? options.followRedirects : 3;

			if (res.statusCode >= 300 && res.statusCode < 400 && followRedirects > 0 && res.headers['location']) {
				resolve(request(Object.assign({}, options, {
					url: res.headers['location'],
					followRedirects: followRedirects - 1
				})));
			} else {
				let stream: Stream = res;

				if (res.headers['content-encoding'] === 'gzip') {
					stream = stream.pipe(createGunzip());
				}

				resolve({ req, res, stream });
			}
		});

		req.on('error', reject);

		if (options.timeout) {
			req.setTimeout(options.timeout);
		}

		if (options.data) {
			req.write(options.data);
		}

		req.end();
	});
}

function isSuccess(context: IRequestContext): boolean {
	return (context.res.statusCode >= 200 && context.res.statusCode < 300) || context.res.statusCode === 1223;
}

function hasNoContent(context: IRequestContext): boolean {
	return context.res.statusCode === 204;
}

export function download(filePath: string, context: IRequestContext): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		const out = createWriteStream(filePath);

		out.once('finish', () => resolve(undefined));
		context.stream.once('error', reject);
		context.stream.pipe(out);
	});
}

export function asJson<T>(context: IRequestContext): Promise<T> {
	return new Promise((resolve, reject) => {
		if (!isSuccess(context)) {
			return reject('Server returned ' + context.res.statusCode);
		}

		if (hasNoContent(context)) {
			return resolve(null);
		}

		if (!/application\/json/.test(context.res.headers['content-type'])) {
			return resolve('Response doesn\'t appear to be JSON');
		}

		const buffer: string[] = [];
		context.stream.on('data', d => buffer.push(d));
		context.stream.on('end', () => resolve(JSON.parse(buffer.join(''))));
		context.stream.on('error', reject);
	});
}