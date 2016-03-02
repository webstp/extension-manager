declare module 'http-proxy-agent' {

	interface IHttpProxyAgentOptions {
		host: string;
		port: number;
		auth?: string;
	}

	class HttpProxyAgent {
		constructor(proxy: string);
		constructor(opts: IHttpProxyAgentOptions);
	}

	export = HttpProxyAgent;
}