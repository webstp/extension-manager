declare module 'https-proxy-agent' {

	import * as tls from 'tls';

	interface IHttpsProxyAgentOptions extends tls.ConnectionOptions {
		host: string;
		port: number;
		auth?: string;
		secureProxy?: boolean;
		secureEndpoint?: boolean;
	}

	class HttpsProxyAgent {
		constructor(proxy: string);
		constructor(opts: IHttpsProxyAgentOptions);
	}

	export = HttpsProxyAgent;
}