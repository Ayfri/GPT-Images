import type { ImageRecord } from '#lib/db/imageStore.ts';
import { gallery } from '#lib/stores/gallery.svelte.ts';
import { OUTPUT_FORMAT_OPTIONS, QUALITY_OPTIONS, SIZE_OPTIONS, getRecordPrice, isImageSize, modelLabel } from '#lib/types/image.ts';
import type { ImageQuality } from '#lib/types/image.ts';
import { oneOf } from '#lib/utils/validate.ts';

const KEY = 'gallery-view';

type Direction = 'asc' | 'desc';

interface SortFieldDef {
	asc: string;
	desc: string;
	initial: Direction;
	key: (image: ImageRecord) => number | string;
	label: string;
}

/** auto is billed as medium (getImagePrice), so it ranks with it. */
const QUALITY_RANK: Record<ImageQuality, number> = { auto: 2, high: 3, low: 1, max: 5, medium: 2, xhigh: 4 };

/** `auto` counts as 1024x1024 like pricing, and so do records without a size. */
const pixels = ({ size = '1024x1024' }: ImageRecord) => (size === 'auto' ? 1024 * 1024 : size.split('x').map(Number).reduce((a, b) => a * b));

/** One shared collator: numeric so "image 2" sorts before "image 10", base sensitivity so case and accents don't split equal prompts. */
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

export const SORT_FIELDS = {
	timestamp: { asc: 'Oldest first', desc: 'Newest first', initial: 'desc', key: ({ timestamp }) => timestamp, label: 'Date' },
	prompt: { asc: 'A to Z', desc: 'Z to A', initial: 'asc', key: ({ prompt }) => prompt, label: 'Prompt' },
	model: { asc: 'A to Z', desc: 'Z to A', initial: 'asc', key: ({ model }) => modelLabel(model), label: 'Model' },
	price: { asc: 'Cheapest first', desc: 'Most expensive first', initial: 'desc', key: getRecordPrice, label: 'Price' },
	quality: { asc: 'Lowest first', desc: 'Highest first', initial: 'desc', key: ({ quality }) => QUALITY_RANK[quality ?? 'low'], label: 'Quality' },
	size: { asc: 'Smallest first', desc: 'Largest first', initial: 'desc', key: pixels, label: 'Size' },
	format: { asc: 'A to Z', desc: 'Z to A', initial: 'asc', key: ({ output_format = 'png' }) => OUTPUT_FORMAT_OPTIONS[output_format].label, label: 'Format' }
} satisfies Record<string, SortFieldDef>;

export type SortField = keyof typeof SORT_FIELDS;

export const GROUP_OPTIONS = {
	none: 'None',
	date: 'Date',
	prompt: 'Prompt',
	model: 'Model',
	library: 'Library',
	format: 'Format',
	quality: 'Quality',
	size: 'Size'
} as const;

export type GroupBy = keyof typeof GROUP_OPTIONS;

export interface ImageGroup {
	cost: number;
	images: ImageRecord[];
	key: string;
	label: string;
}

interface ViewPrefs {
	collapsed: string[];
	direction: Direction;
	groupBy: GroupBy;
	library: string | null;
	sortField: SortField;
}

/** One validator per saved field: stored prefs are untrusted, so an invalid or outdated value keeps its default. */
const VALID: { [K in keyof ViewPrefs]: (value: unknown) => value is ViewPrefs[K] } = {
	collapsed: (value): value is string[] => Array.isArray(value) && value.every((key) => typeof key === 'string'),
	direction: (value): value is Direction => value === 'asc' || value === 'desc',
	groupBy: oneOf<GroupBy>(GROUP_OPTIONS),
	library: (value): value is string | null => value === null || typeof value === 'string',
	sortField: oneOf<SortField>(SORT_FIELDS)
};

const isPrefKey = (key: string): key is keyof ViewPrefs => Object.hasOwn(VALID, key);

/** Zero-padded so day keys compare chronologically as strings. */
const dayKey = (time: number) => {
	const date = new Date(time);
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};

const normalize = (prompt: string) => prompt.trim().replace(/\s+/g, ' ');

class GalleryView {
	prefs = $state<ViewPrefs>({ collapsed: [], direction: 'desc', groupBy: 'none', library: null, sortField: 'timestamp' });
	/** Not persisted: a saved filter would silently hide images on the next visit. */
	search = $state('');

	get sortField() {
		return this.prefs.sortField;
	}

	set sortField(field: SortField) {
		this.prefs.sortField = field;
		this.prefs.direction = SORT_FIELDS[field].initial;
	}

	get groupBy() {
		return this.prefs.groupBy;
	}

	/** Group keys mean nothing across modes, so changing the mode drops the collapsed ones. */
	set groupBy(mode: GroupBy) {
		this.prefs.groupBy = mode;
		this.prefs.collapsed = [];
	}

	collapsed = $derived(new Set(this.prefs.collapsed));

	/** Keys of groups no longer shown are dropped, so the saved list stays bounded within a mode. */
	toggleCollapsed = (key: string) => {
		const shown = new Set(this.groups.map((group) => group.key));
		const kept = this.prefs.collapsed.filter((collapsedKey) => shown.has(collapsedKey) && collapsedKey !== key);
		this.prefs.collapsed = this.collapsed.has(key) ? kept : [...kept, key];
	};

	/** A stale id resolves to undefined, which reads as "All images". */
	activeLibrary = $derived(gallery.libraries.find(({ id }) => id === this.prefs.library));

	filtered = $derived.by(() => {
		const library = this.activeLibrary?.id;
		const words = this.search.toLowerCase().split(/\s+/).filter(Boolean);
		if (!library && !words.length) return gallery.images;

		return gallery.images.filter((image) => {
			const prompt = image.prompt.toLowerCase();
			return (!library || image.libraries?.includes(library)) && words.every((word) => prompt.includes(word));
		});
	});

	sorted = $derived.by(() => {
		const sign = this.prefs.direction === 'asc' ? 1 : -1;
		const { key } = SORT_FIELDS[this.prefs.sortField];
		/** Ties always fall back to newest first, whatever the direction. */
		return this.filtered
			.map((image) => ({ image, key: key(image) }))
			.sort((a, b) => sign * (typeof a.key === 'number' && typeof b.key === 'number' ? a.key - b.key : collator.compare(String(a.key), String(b.key))) || b.image.timestamp - a.image.timestamp)
			.map(({ image }) => image);
	});

	#names = $derived(new Map(gallery.libraries.map(({ id, name }) => [id, name])));

	#groupers: Record<GroupBy, { keys: (image: ImageRecord) => string[]; label: (key: string, image: ImageRecord) => string }> = {
		none: { keys: () => [''], label: () => '' },
		date: {
			keys: ({ timestamp }) => [dayKey(timestamp)],
			label: (key, { timestamp }) => {
				const now = new Date();
				if (key === dayKey(now.getTime())) return 'Today';
				/** Built from the calendar date so a daylight saving change can't shift it by an hour into the wrong day. */
				if (key === dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime())) return 'Yesterday';
				return new Date(timestamp).toLocaleDateString(undefined, { dateStyle: 'full' });
			}
		},
		prompt: { keys: ({ prompt }) => [normalize(prompt).toLowerCase()], label: (_, { prompt }) => normalize(prompt) },
		model: { keys: ({ model = 'gpt-image-1' }) => [model], label: (_, { model }) => modelLabel(model) },
		library: {
			keys: ({ libraries = [] }) => {
				const known = libraries.filter((id) => this.#names.has(id));
				return known.length ? known : [''];
			},
			label: (key) => this.#names.get(key) ?? 'No library'
		},
		format: { keys: ({ output_format = 'png' }) => [output_format], label: (_, { output_format = 'png' }) => OUTPUT_FORMAT_OPTIONS[output_format].label },
		quality: { keys: ({ quality = 'low' }) => [quality], label: (_, { quality = 'low' }) => QUALITY_OPTIONS[quality].label },
		size: {
			keys: ({ size = '1024x1024' }) => [size],
			label: (key) => (isImageSize(key) ? SIZE_OPTIONS[key].label : key.replace('x', '×'))
		}
	};

	/** Group order follows the sort, the first image of each group placing it, except days: they stay in calendar order, oldest first only on an oldest-first date sort. */
	groups = $derived.by((): ImageGroup[] => {
		const grouper = this.#groupers[this.prefs.groupBy];
		const groups = new Map<string, ImageGroup>();
		for (const image of this.sorted)
			for (const key of grouper.keys(image)) {
				let group = groups.get(key);
				if (!group) groups.set(key, (group = { cost: 0, images: [], key, label: grouper.label(key, image) }));
				group.images.push(image);
				group.cost += getRecordPrice(image);
			}
		if (this.prefs.groupBy !== 'date') return [...groups.values()];
		const sign = this.prefs.sortField === 'timestamp' && this.prefs.direction === 'asc' ? 1 : -1;
		return [...groups.values()].sort((a, b) => sign * a.key.localeCompare(b.key));
	});

	/** Images of collapsed groups are skipped, and the Set keeps an image sitting in several library groups to one stop. */
	lightboxImages = $derived([...new Set(this.groups.flatMap((group) => (this.collapsed.has(group.key) ? [] : group.images)))]);

	restore = () => {
		try {
			const entries: [string, unknown][] = Object.entries(JSON.parse(localStorage.getItem(KEY) ?? '{}'));
			for (const [key, value] of entries) if (isPrefKey(key)) this.#restore(key, value);
		} catch {}
	};

	#restore<K extends keyof ViewPrefs>(key: K, value: unknown) {
		if (VALID[key](value)) this.prefs[key] = value;
	}

	/** An arrow field, so `$effect(galleryView.save)` keeps `this`. */
	save = () => localStorage.setItem(KEY, JSON.stringify(this.prefs));
}

export const galleryView = new GalleryView();
