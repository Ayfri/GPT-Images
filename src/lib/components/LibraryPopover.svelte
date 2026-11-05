<script lang="ts">
	import { FolderPlus, Plus } from '@lucide/svelte';
	import { SvelteSet } from 'svelte/reactivity';
	import type { ImageRecord } from '#lib/db/imageStore.ts';
	import { gallery } from '#lib/stores/gallery.svelte.ts';

	interface Props {
		image: ImageRecord;
	}

	let { image }: Props = $props();

	const id = $props.id();
	const draft = new SvelteSet<string>();

	let name = $state('');
	let open = $state(false);

	/** Changes apply on close: applying them live would move the card out of its group or filter and destroy the open popover. */
	function onToggle(event: ToggleEvent) {
		open = event.newState === 'open';
		const before = image.libraries ?? [];
		if (open) {
			draft.clear();
			for (const libraryId of before) draft.add(libraryId);
		} else if (draft.size !== before.length || before.some((libraryId) => !draft.has(libraryId))) {
			gallery.setLibraries(image.id, [...draft]).catch((error: unknown) => console.error('Failed to update the image libraries:', error));
		}
	}

	async function create(event: SubmitEvent) {
		event.preventDefault();
		const trimmed = name.trim();
		if (!trimmed) return;

		try {
			draft.add((await gallery.createLibrary(trimmed)).id);
			name = '';
		} catch (error) {
			console.error('Failed to create the library:', error);
		}
	}
</script>

<button
	aria-label="Add to library"
	class="btn-ghost rounded-xl bg-black/40 p-2 backdrop-blur-sm hover:bg-primary-700/25"
	popovertarget={id}
	style:anchor-name="--{id}"
	title="Add to library"
	type="button"
>
	<FolderPlus class="h-4 w-4 text-primary-300" />
</button>

<!-- The panel stays `visible` because it inherits `visibility` from a card overlay that hides itself when the hover ends. -->
<div
	{id}
	aria-label="Libraries"
	class="anchored-popover visible w-56 rounded-2xl border border-white/6 bg-dark-200 p-3 text-gray-200 shadow-xl"
	ontoggle={onToggle}
	popover="auto"
	role="dialog"
	style:position-anchor="--{id}"
>
	{#if open}
		<div {@attach (node) => node.querySelector('input')?.focus()}>
			<div class="max-h-56 space-y-1 overflow-y-auto">
				{#each gallery.libraries as library (library.id)}
					<label class="flex cursor-pointer items-center gap-2 rounded-lg px-1.5 py-1 text-sm hover:bg-white/8">
						<input
							checked={draft.has(library.id)}
							class="accent-primary-500"
							onchange={(event) => (event.currentTarget.checked ? draft.add(library.id) : draft.delete(library.id))}
							type="checkbox"
						/>
						<span class="truncate">{library.name}</span>
					</label>
				{:else}
					<p class="px-1.5 py-1 text-sm text-gray-500">No libraries yet</p>
				{/each}
			</div>

			<form class="mt-2 flex items-center gap-1.5 border-t border-white/6 pt-2" onsubmit={create}>
				<input
					aria-label="New library name"
					bind:value={name}
					class="min-w-0 grow rounded-lg border border-white/8 bg-dark-100/80 px-2.5 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-hidden focus:ring-2 focus:ring-primary-500/60"
					maxlength="40"
					placeholder="New library"
				/>
				<button aria-label="Create library" class="btn-ghost rounded-lg p-1.5 hover:bg-primary-700/25" title="Create library" type="submit">
					<Plus class="h-4 w-4 text-primary-300" />
				</button>
			</form>
		</div>
	{/if}
</div>
