<script lang="ts">
	import { Library, Pencil, Plus, Trash } from '@lucide/svelte';
	import ConfirmPopover from './ConfirmPopover.svelte';
	import { gallery } from '#lib/stores/gallery.svelte.ts';
	import { galleryView } from '#lib/stores/galleryView.svelte.ts';

	const CHIP = 'flex cursor-pointer items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors';
	const IDLE = 'border-white/8 bg-white/3 text-gray-400 hover:bg-white/8';
	const ACTIVE = 'border-primary-500/40 bg-primary-500/15 text-primary-300';

	let editing: 'create' | 'rename' | null = $state(null);
	let draft = $state('');

	const active = $derived(galleryView.activeLibrary);
	const named = $derived(gallery.libraryNamed(draft));
	const clash = $derived(editing === 'rename' && named !== undefined && named.id !== active?.id);

	function startEditing(mode: 'create' | 'rename', name: string) {
		draft = name;
		editing = mode;
	}

	async function submit(event: SubmitEvent) {
		event.preventDefault();
		const name = draft.trim();
		if (!name || clash) return;

		try {
			if (editing === 'rename' && active) await gallery.renameLibrary(active.id, name);
			else galleryView.prefs.library = (await gallery.createLibrary(name)).id;
		} catch (error) {
			console.error('Failed to save the library:', error);
		}
		editing = null;
	}

	const remove = (id: string) =>
		gallery
			.deleteLibrary(id)
			.then(() => (galleryView.prefs.library = null))
			.catch((error: unknown) => console.error('Failed to delete the library:', error));
</script>

{#snippet nameForm()}
	<form class="flex items-center gap-2" onsubmit={submit}>
		<input
			{@attach (input) => input.focus()}
			aria-describedby={clash ? 'library-name-hint' : undefined}
			aria-invalid={clash}
			aria-label="Library name"
			bind:value={draft}
			class="w-36 rounded-full border border-primary-500/40 bg-dark-100/80 px-3 py-1 text-xs text-gray-200 placeholder-gray-600 focus:outline-hidden aria-invalid:border-error-500"
			maxlength="40"
			onblur={() => (editing = null)}
			onkeydown={(event) => event.key === 'Escape' && (editing = null)}
			placeholder="Library name"
		/>
		{#if clash}
			<span class="text-xs text-error-400" id="library-name-hint">A library with this name already exists</span>
		{/if}
	</form>
{/snippet}

<div class="mb-6 flex flex-wrap items-center gap-2">
	<button aria-pressed={!active} class="{CHIP} {active ? IDLE : ACTIVE}" onclick={() => (galleryView.prefs.library = null)} type="button">
		<Library class="h-3.5 w-3.5 shrink-0" />
		All images
		<span class="tabular-nums opacity-60">{gallery.images.length}</span>
	</button>

	{#each gallery.libraries as library (library.id)}
		{#if editing === 'rename' && library.id === active?.id}
			{@render nameForm()}
		{:else}
			<button aria-pressed={library.id === active?.id} class="{CHIP} {library.id === active?.id ? ACTIVE : IDLE}" onclick={() => (galleryView.prefs.library = library.id)} type="button">
				<span class="max-w-40 truncate">{library.name}</span>
				<span class="tabular-nums opacity-60">{gallery.libraryCounts.get(library.id) ?? 0}</span>
			</button>
		{/if}
	{/each}

	{#if editing === 'create'}
		{@render nameForm()}
	{:else}
		<button class="{CHIP} {IDLE}" onclick={() => startEditing('create', '')} type="button">
			<Plus class="h-3.5 w-3.5 shrink-0" />
			New library
		</button>
	{/if}

	{#if active}
		<button aria-label="Rename library" class="btn-ghost rounded-xl p-1.5" onclick={() => startEditing('rename', active.name)} title="Rename library" type="button">
			<Pencil class="h-4 w-4 text-gray-400" />
		</button>
		<ConfirmPopover
			class="btn-ghost rounded-xl p-1.5 hover:bg-error-700/25"
			confirmLabel="Delete library"
			label="Delete library"
			message={`Delete "${active.name}"? Its images stay in your history.`}
			onconfirm={() => remove(active.id)}
		>
			<Trash class="h-4 w-4 text-error-400" />
		</ConfirmPopover>
	{/if}
</div>
