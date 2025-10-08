import { useEffect, useMemo, useState } from "react";

type UseSearchPaginationOptions<T> = {
	filter: (item: T, normalizedTerm: string) => boolean;
	pageSize?: number;
};

type PageUpdater = number | ((prev: number) => number);

type UseSearchPaginationReturn<T> = {
	searchTerm: string;
	setSearchTerm: (value: string) => void;
	page: number;
	setPage: (value: PageUpdater) => void;
	totalPages: number;
	filteredItems: T[];
	paginatedItems: T[];
	pageSize: number;
};

export function useSearchPagination<T>(
	items: T[],
	{ filter, pageSize = 8 }: UseSearchPaginationOptions<T>
): UseSearchPaginationReturn<T> {
	const [searchTerm, setSearchTerm] = useState("");
	const [page, setPageState] = useState(1);

	const normalizedTerm = searchTerm.trim().toLowerCase();

	const filteredItems = useMemo(() => {
		if (!normalizedTerm) return items;
		return items.filter((item) => filter(item, normalizedTerm));
	}, [filter, items, normalizedTerm]);

	const totalPages = useMemo(
		() => Math.max(1, Math.ceil(filteredItems.length / pageSize)),
		[filteredItems, pageSize]
	);

	useEffect(() => {
		setPageState(1);
	}, [normalizedTerm]);

	useEffect(() => {
		setPageState((prev) => Math.min(prev, totalPages));
	}, [totalPages]);

	const paginatedItems = useMemo(() => {
		if (!filteredItems.length) return [];
		const start = (page - 1) * pageSize;
		return filteredItems.slice(start, start + pageSize);
	}, [filteredItems, page, pageSize]);

	return {
		searchTerm,
		setSearchTerm,
		page,
		setPage: (value) => {
			setPageState((prev) => {
				const next =
					typeof value === "function"
						? (value as (current: number) => number)(prev)
						: value;
				return Math.min(Math.max(1, next), totalPages);
			});
		},
		totalPages,
		filteredItems,
		paginatedItems,
		pageSize,
	};
}
