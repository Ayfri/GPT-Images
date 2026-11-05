<script lang="ts">
	import { onMount } from 'svelte';
	import type { Attachment } from 'svelte/attachments';
	import { fly } from 'svelte/transition';
	import { ArrowDownWideNarrow, ArrowUpNarrowWide, ChevronRight, Image as ImageIcon, Layers, Search } from '@lucide/svelte';
	import ImageCard from './ImageCard.svelte';
	import ImageLightbox from './ImageLightbox.svelte';
	import LibraryBar from './LibraryBar.svelte';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { GROUP_OPTIONS, SORT_FIELDS, galleryView } from '#lib/stores/galleryView.svelte.ts';
	import type { ImageGroup } from '#lib/stores/galleryView.svelte.ts';
	import { flip } from 'svelte/animate';

	interface Props {
		onRegenerate: (prompt: string) => void;
		onEdit: (image: ImageRecord) => void;
	}

	let { onRegenerate, onEdit }: Props = $props();

	const PAGE_SIZE = 12;
	const selectClass = 'cursor-pointer rounded-lg bg-transparent py-0.5 pr-1.5 pl-1 text-sm font-medium text-gray-200 hover:text-white focus:outline-hidden focus-visible:ring-2 focus-visible:ring-primary-500/60';

	let shown = $state(PAGE_SIZE);
	let viewId: string | null = $state(null);

	const order = $derived(SORT_FIELDS[galleryView.sortField][galleryView.prefs.direction]);
	const filtering = $derived(galleryView.filtered !== gallery.images);

	/** A collapsed group costs no budget, so it renders as soon as it's reached. */
	const page = $derived.by(() => {
		let budget = shown;
		let truncated = false;
		const entries: { group: ImageGroup; images: ImageRecord[] }[] = [];
		for (const group of galleryView.groups) {
			if (budget <= 0) break;
			const collapsed = galleryView.collapsed.has(group.key);
			const images = collapsed ? [] : group.images.slice(0, budget);
			truncated ||= images.length < group.images.length && !collapsed;
			budget -= images.length;
			entries.push({ group, images });
		}
		return { entries, more: truncated || entries.length < galleryView.groups.length };
	});

	/** Reading `shown` re-creates the observer after each page, so a sentinel still in view keeps loading the next page. */
	const sentinel: Attachment<HTMLDivElement> = (target) => {
		const nextShown = shown + PAGE_SIZE;
		const observer = new IntersectionObserver(([entry]) => entry.isIntersecting && (shown = nextShown), { rootMargin: '200px' });
		observer.observe(target);
		return () => observer.disconnect();
	};

	/** Registered before the save effect, so the first save writes the restored view and not the defaults. */
	onMount(() => {
		galleryView.restore();
		void gallery.load();
	});
	$effect(galleryView.save);
</script>

<div>
	<div class="mb-6 flex flex-wrap items-end justify-between gap-3">
		<div>
			<h2 class="text-base font-semibold text-gray-100">Image history</h2>
			<p class="mt-0.5 text-xs text-gray-600">
				{#if filtering}
					{galleryView.filtered.length} of {gallery.images.length} images
				{:else}
					{gallery.images.length} image{gallery.images.length !== 1 ? 's' : ''} generated
				{/if}
			</p>
		</div>
		<div class="flex flex-wrap items-center gap-2">
			<div class="glass-panel flex grow items-center gap-2 px-3 py-1.5 sm:grow-0">
				<Search class="h-4 w-4 shrink-0 text-gray-500" />
				<input
					aria-label="Search prompts"
					bind:value={galleryView.search}
					class="w-full bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-hidden sm:w-40"
					placeholder="Search prompts"
					type="search"
				/>
			</div>
			<div class="glass-panel flex items-center gap-2 px-3 py-1.5">
				<label class="text-xs text-gray-500" for="sort-by-images">Sort</label>
				<select bind:value={galleryView.sortField} class={selectClass} id="sort-by-images">
					{#each Object.entries(SORT_FIELDS) as [key, field] (key)}
						<option value={key}>{field.label}</option>
					{/each}
				</select>
			</div>
			<button
				aria-label="Sort order: {order}"
				class="glass-panel flex cursor-pointer items-center gap-2 rounded-xl px-2.5 py-1.5 text-sm text-gray-400 transition-all duration-200 hover:bg-white/8 hover:text-white"
				onclick={() => (galleryView.prefs.direction = galleryView.prefs.direction === 'asc' ? 'desc' : 'asc')}
				title="Sort order: {order}"
				type="button"
			>
				{#if galleryView.prefs.direction === 'asc'}
					<ArrowUpNarrowWide class="h-4 w-4" />
				{:else}
					<ArrowDownWideNarrow class="h-4 w-4" />
				{/if}
				<span class="max-sm:sr-only">{order}</span>
			</button>
			<div class="glass-panel flex items-center gap-2 px-3 py-1.5">
				<label class="text-gray-500" for="group-by-images" title="Group by">
					<Layers class="h-4 w-4" />
					<span class="sr-only">Group by</span>
				</label>
				<select bind:value={galleryView.groupBy} class={selectClass} id="group-by-images">
					{#each Object.entries(GROUP_OPTIONS) as [key, label] (key)}
						<option value={key}>{label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>

	{#if gallery.dbState === 'outdated'}
		<div class="mb-6 flex flex-wrap items-center gap-3 rounded-xl border border-warning-600/20 bg-warning-900/20 px-3 py-2 text-sm text-warning-400">
			A newer version of this app is open in another tab. Reload this one.
			<button class="btn-ghost rounded-lg px-3 py-1 text-sm" onclick={() => location.reload()} type="button">Reload</button>
		</div>
	{/if}

	{#if gallery.loaded}
		<LibraryBar />
	{/if}

	{#if !gallery.loaded}
		<div class="flex h-40 items-center justify-center px-4 text-center">
			<div class="animate-pulse-slow text-gray-500">
				{gallery.dbState === 'blocked' ? 'Close the other tabs or windows of this app to finish updating its storage.' : 'Loading images…'}
			</div>
		</div>
	{:else if gallery.images.length === 0}
		<div
			class="rounded-2xl border border-dashed border-white/8 bg-white/2 px-6 py-16 text-center"
			in:fly={{ duration: 400, y: 20 }}
		>
			<div class="relative mb-4 inline-flex h-16 w-16 items-center justify-center">
				<div class="absolute inset-0 animate-pulse rounded-2xl bg-primary-500/10"></div>
				<ImageIcon class="relative h-8 w-8 text-primary-400/60" />
			</div>
			<h3 class="mb-1 text-base font-semibold text-gray-300">No images yet</h3>
			<p class="mx-auto max-w-xs text-sm text-gray-600">
				Generate your first image above and it will appear here
			</p>
		</div>
	{:else if galleryView.filtered.length === 0}
		<div
			class="rounded-2xl border border-dashed border-white/8 bg-white/2 px-6 py-16 text-center"
			in:fly={{ duration: 400, y: 20 }}
		>
			{#if galleryView.search.trim()}
				<h3 class="text-base font-semibold text-gray-300">No image matches this search</h3>
			{:else}
				<h3 class="mb-1 text-base font-semibold text-gray-300">This library is empty</h3>
				<p class="mx-auto max-w-xs text-sm text-gray-600">
					Images generated while it's open are added to it. Add existing ones with the folder button on a card.
				</p>
			{/if}
		</div>
	{:else}
		<div class="space-y-8">
			{#each page.entries as { group, images } (group.key)}
				<section>
					{#if galleryView.groupBy !== 'none'}
						{@const collapsed = galleryView.collapsed.has(group.key)}
						<button
							aria-expanded={!collapsed}
							class="mb-3 flex w-full cursor-pointer items-center gap-2 text-left"
							onclick={() => galleryView.toggleCollapsed(group.key)}
							type="button"
						>
							<ChevronRight class="h-4 w-4 shrink-0 text-gray-500 transition-transform {collapsed ? '' : 'rotate-90'}" />
							<span class="truncate text-sm font-semibold text-gray-200" title={group.label}>{group.label}</span>
							<span class="shrink-0 text-xs text-gray-600">{group.images.length} image{group.images.length !== 1 ? 's' : ''}</span>
							<span class="ms-auto shrink-0 rounded-md border border-secondary-500/20 bg-secondary-500/10 px-2 py-0.5 text-xs font-semibold text-secondary-400">
								${group.cost.toFixed(2)}
							</span>
						</button>
					{/if}
					{#if images.length > 0}
						<div class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
							{#each images as image, i (image.id)}
								<div animate:flip={{ duration: 300 }} in:fly={{ delay: 50 * (i % PAGE_SIZE), duration: 300, y: 20 }}>
									<ImageCard {image} {onEdit} {onRegenerate} onView={() => (viewId = image.id)} />
								</div>
							{/each}
						</div>
					{/if}
				</section>
			{/each}
		</div>

		{#if page.more}
			<div {@attach sentinel} class="mt-8 min-h-px"></div>
		{/if}
	{/if}
</div>

<ImageLightbox images={galleryView.lightboxImages} bind:id={viewId} />
