import { Url, parse as parseUrl } from 'url';
import { Agent } from './request';
import HttpProxyAgent = require('http-proxy-agent');
import HttpsProxyAgent = require('https-proxy-agent');
import { isBoolean } from 'lodash';
import { workspace } from 'vscode'

function getSystemProxyURI(requestURL: Url): string {
	if (requestURL.protocol === 'http:') {
		return workspace.getConfiguration('http').get('proxy') || 
                process.env.HTTP_PROXY || 
                process.env.http_proxy || 
                null;
	} else if (requestURL.protocol === 'https:') {
		return process.env.HTTPS_PROXY || 
                process.env.https_proxy || 
                workspace.getConfiguration('http').get('proxy') ||
                process.env.HTTP_PROXY || 
                process.env.http_proxy || 
                null;
	}

	return null;
}

export function getProxyAgent(rawRequestURL: string): Agent {
	const requestURL = parseUrl(rawRequestURL);
	const proxyURL = getSystemProxyURI(requestURL);
    const strictSSL = workspace.getConfiguration('http').get('proxyStrictSSL');

	if (!proxyURL) {
		return null;
	}

	const proxyEndpoint = parseUrl(proxyURL);

	if (!/^https?:$/.test(proxyEndpoint.protocol)) {
		return null;
	}

	const opts = {
		host: proxyEndpoint.hostname,
		port: Number(proxyEndpoint.port),
		auth: proxyEndpoint.auth,
		rejectUnauthorized: isBoolean(strictSSL) ? strictSSL : true
	};

	return requestURL.protocol === 'http:' ? new HttpProxyAgent(opts) : new HttpsProxyAgent(opts);
}