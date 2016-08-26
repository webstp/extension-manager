export interface IParsedVersion {
	hasCaret: boolean;
	majorBase: number;
	majorMustEqual: boolean;
	minorBase: number;
	minorMustEqual: boolean;
	patchBase: number;
	patchMustEqual: boolean;
	preRelease: string;
}

export interface INormalizedVersion {
	majorBase: number;
	majorMustEqual: boolean;
	minorBase: number;
	minorMustEqual: boolean;
	patchBase: number;
	patchMustEqual: boolean;
}

const VERSION_REGEXP = /^(\^)?((\d+)|x)\.((\d+)|x)\.((\d+)|x)(\-.*)?$/;

export function isValidVersionStr(version: string): boolean {
	version = version.trim();
	return (version === '*' || VERSION_REGEXP.test(version));
}

export function parseVersion(version: string): IParsedVersion {
	if (!isValidVersionStr(version)) {
		return null;
	}

	version = version.trim();

	if (version === '*') {
		return {
			hasCaret: false,
			majorBase: 0,
			majorMustEqual: false,
			minorBase: 0,
			minorMustEqual: false,
			patchBase: 0,
			patchMustEqual: false,
			preRelease: null
		};
	}

	let m = version.match(VERSION_REGEXP);
	return {
		hasCaret: !!m[1],
		majorBase: m[2] === 'x' ? 0 : parseInt(m[2], 10),
		majorMustEqual: (m[2] === 'x' ? false : true),
		minorBase: m[4] === 'x' ? 0 : parseInt(m[4], 10),
		minorMustEqual: (m[4] === 'x' ? false : true),
		patchBase: m[6] === 'x' ? 0 : parseInt(m[6], 10),
		patchMustEqual: (m[6] === 'x' ? false : true),
		preRelease: m[8] || null
	};
}

export function normalizeVersion(version: IParsedVersion): INormalizedVersion {
	if (!version) {
		return null;
	}

	let { majorBase, majorMustEqual, minorBase, minorMustEqual, patchBase, patchMustEqual } = version;

	if (version.hasCaret) {
		if (majorBase === 0) {
			patchMustEqual = false;
		} else {
			minorMustEqual = false;
			patchMustEqual = false;
		}
	}

	return { majorBase, majorMustEqual, minorBase, minorMustEqual, patchBase, patchMustEqual };
}

export function isValidVersion(_version: string | INormalizedVersion, _desiredVersion: string | INormalizedVersion): boolean {
	let version: INormalizedVersion = (typeof _version === 'string') ?
		normalizeVersion(parseVersion(_version)) : _version;
	let desiredVersion: INormalizedVersion = (typeof _desiredVersion === 'string') ?
		normalizeVersion(parseVersion(_desiredVersion)) : _desiredVersion;

	if (!version || !desiredVersion) {
		return false;
	}

	let { majorBase, minorBase, patchBase } = version;
    let { majorBase: desiredMajorBase, minorBase: desiredMinorBase, patchBase: desiredPatchBase } = desiredVersion;
    let { majorMustEqual, minorMustEqual, patchMustEqual } = desiredVersion;
	
	// Anything < 1.0.0 is compatible with >= 1.0.0, except exact matches
	if (majorBase === 1 && desiredMajorBase === 0 && (!majorMustEqual || !minorMustEqual || !patchMustEqual)) {
		desiredMajorBase = 1;
		desiredMinorBase = 0;
		desiredPatchBase = 0;
		majorMustEqual = true;
		minorMustEqual = false;
		patchMustEqual = false;
	}

	if (majorBase < desiredMajorBase) {
		// smaller major version
		return false;
	}

	if (majorBase > desiredMajorBase) {
		// higher major version
		return (!majorMustEqual);
	}

	// at this point, majorBase are equal

	if (minorBase < desiredMinorBase) {
		// smaller minor version
		return false;
	}

	if (minorBase > desiredMinorBase) {
		// higher minor version
		return (!minorMustEqual);
	}

	// at this point, minorBase are equal

	if (patchBase < desiredPatchBase) {
		// smaller patch version
		return false;
	}

	if (patchBase > desiredPatchBase) {
		// higher patch version
		return (!patchMustEqual);
	}

	// at this point, patchBase are equal
	return true;
}

export interface IReducedExtensionDescription {
	isBuiltin: boolean;
	engines: {
		vscode: string;
	};
	main?: string;
}

export function isValidExtensionVersion(version: string, extensionDesc: IReducedExtensionDescription, notices: string[]): boolean {

	if (extensionDesc.isBuiltin || typeof extensionDesc.main === 'undefined') {
		// No version check for builtin or declarative extensions
		return true;
	}

	let desiredVersion = normalizeVersion(parseVersion(extensionDesc.engines.vscode));
	if (!desiredVersion) {
		notices.push(`Could not parse 'engines.vscode' value ${extensionDesc.engines.vscode}. Please use, for example: ^0.10.0, ^1.2.3, ^0.11.0, ^0.10.x, etc.`);
		return false;
	}

	// enforce that a breaking API version is specified.
	// for 0.X.Y, that means up to 0.X must be specified
	// otherwise for Z.X.Y, that means Z must be specified
	if (desiredVersion.majorBase === 0) {
		// force that major and minor must be specific
		if (!desiredVersion.majorMustEqual || !desiredVersion.minorMustEqual) {
			notices.push(`Version specified in 'engines.vscode' (${extensionDesc.engines.vscode}) is not specific enough. For vscode versions before 1.0.0, please define at a minimum the major and minor desired version. E.g. ^0.10.0, 0.10.x, 0.11.0, etc.`);
			return false;
		}
	} else {
		// force that major must be specific
		if (!desiredVersion.majorMustEqual) {
			notices.push(`Version specified in 'engines.vscode' (${extensionDesc.engines.vscode}) is not specific enough. For vscode versions after 1.0.0, please define at a minimum the major desired version. E.g. ^1.10.0, 1.10.x, 1.x.x, 2.x.x, etc.`);
			return false;
		}
	}

	if (!isValidVersion(version, desiredVersion)) {
		notices.push(`Extension is not compatible with Code ${version}. Extension requires: ${extensionDesc.engines.vscode}.`);
		return false;
	}

	return true;
}