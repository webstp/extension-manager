import { isUndefined } from 'lodash';

export enum Flags {
	None = 0x0,
	IncludeVersions = 0x1,
	IncludeFiles = 0x2,
	IncludeCategoryAndTags = 0x4,
	IncludeSharedAccounts = 0x8,
	IncludeVersionProperties = 0x10,
	ExcludeNonValidated = 0x20,
	IncludeInstallationTargets = 0x40,
	IncludeAssetUri = 0x80,
	IncludeStatistics = 0x100,
	IncludeLatestVersionOnly = 0x200
}

export enum SortBy {
	NoneOrRelevance = 0,
	LastUpdatedDate = 1,
	Title = 2,
	PublisherName = 3,
	InstallCount = 4,
	PublishedDate = 5,
	AverageRating = 6
}

export enum SortOrder {
	Default = 0,
	Ascending = 1,
	Descending = 2
}

export enum FilterType {
	Tag = 1,
	ExtensionId = 4,
	Category = 5,
	ExtensionName = 7,
	Target = 8,
	Featured = 9,
	SearchText = 10
}

interface ICriterium {
	filterType: FilterType;
	value?: string;
}

export class Query {
    private criteria: ICriterium[] = [];
    private sortBy: SortBy = SortBy.NoneOrRelevance;
    private sortOrder: SortOrder = SortOrder.Default;
    private flags: number = Flags.None;
    private assetTypes: string[] = [];

	withFilter(filterType: FilterType, value?: string): Query {
		const criterium: ICriterium = { filterType };

		if (!isUndefined(value)) {
			criterium.value = value;
		}

		this.criteria.push(criterium)
		return this;
	}

	withSortBy(sortBy: SortBy): Query {
        this.sortBy = sortBy;
        return this;
	}

	withSortOrder(sortOrder: SortOrder): Query {
        this.sortOrder = sortOrder;
        return this;
	}

	withFlags(...flags: Flags[]): Query {
        this.flags = flags.reduce((r, f) => r | f, 0);
        return this;
	}

	withAssetTypes(...assetTypes: string[]): Query {
        this.assetTypes = assetTypes;
        return this;
	}

	get raw(): any {
		const { criteria, sortBy, sortOrder, flags, assetTypes } = this;
		const filters = [{ criteria, sortBy, sortOrder }];
		return { filters, assetTypes, flags };
	}
}