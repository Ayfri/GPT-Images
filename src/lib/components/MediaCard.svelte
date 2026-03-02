<script lang="ts">
	import type { Snippet } from 'svelte';
	import { Copy, Download, RefreshCw, Trash2 } from 'lucide-svelte';
	import { fade, fly } from 'svelte/transition';
	import { formatDate } from '$lib/utils/formatDate';

	interface Props {
		prompt: string;
		price: number;
		priceDecimals?: number;
		timestamp: number;
		aspectClass?: string;
		copied: boolean;
		media: Snippet;
		extraAction?: Snippet;
		onDelete: () => void;
		onCopy: () => void;
		onDownload: () => void;
		onRegenerate: () => void;
		onView: () => void;
		onCardHoverChange?: (hovering: boolean) => void;
	}

	let {
		prompt,
		price,
		priceDecimals = 3,
		timestamp,
		aspectClass = 'aspect-square',
		copied,
		media,
		extraAction,
		onDelete,
		onCopy,
		onDownload,
		onRegenerate,
		onView,
		onCardHoverChange,
	}: Props = $props();

	let showControls = $state(false);
</script>

<div
	class="card card-gradient-border group relative overflow-hidden transition-all duration-300 hover:-translate-y-1"
	onmouseenter={() => showControls = true}
	onmouseleave={() => showControls = false}
	onfocusin={() => showControls = true}
	onfocusout={() => showControls = false}
	role="article"
>
	<div
		class="relative {aspectClass} cursor-pointer overflow-hidden"
		onclick={onView}
		onkeydown={(e) => e.key === 'Enter' && onView()}
		role="button"
		tabindex="0"
	>
		{@render media()}

		{#if showControls}
			<div
				class="absolute inset-0 flex flex-col justify-end"
				style="background: linear-gradient(to top, rgba(17,17,27,0.95) 0%, rgba(17,17,27,0.5) 40%, transparent 70%)"
				transition:fade={{ duration: 180 }}
			>
				<div class="p-3 flex items-center justify-between">
					<button
						onclick={(e) => { e.stopPropagation(); onDelete(); }}
						class="btn-ghost p-2 rounded-xl hover:bg-error-700/25 group/del"
						aria-label="Delete"
						title="Delete"
					>
						<Trash2 class="w-4 h-4 text-error-400 group-hover/del:scale-110 transition-transform" />
					</button>

					<div class="flex items-center gap-1">
						<button
							onclick={(e) => { e.stopPropagation(); onCopy(); }}
							class="btn-ghost p-2 rounded-xl hover:bg-primary-700/25 group/copy"
							aria-label="Copy prompt"
							title="Copy prompt"
						>
							<Copy class="w-4 h-4 text-primary-300 group-hover/copy:scale-110 transition-transform" />
						</button>

						<button
							onclick={(e) => { e.stopPropagation(); onDownload(); }}
							class="btn-ghost p-2 rounded-xl hover:bg-secondary-700/25 group/dl"
							aria-label="Download"
							title="Download"
						>
							<Download class="w-4 h-4 text-secondary-300 group-hover/dl:scale-110 transition-transform" />
						</button>

						{#if extraAction}
							{@render extraAction()}
						{/if}

						<button
							onclick={(e) => { e.stopPropagation(); onRegenerate(); }}
							class="btn-ghost p-2 rounded-xl hover:bg-accent-700/25 group/regen"
							aria-label="Regenerate with this prompt"
							title="Regenerate"
						>
							<RefreshCw class="w-4 h-4 text-accent-300 group-hover/regen:scale-110 group-hover/regen:rotate-180 transition-transform duration-300" />
						</button>
					</div>
				</div>
			</div>
		{/if}

		{#if copied}
			<div
				class="absolute bottom-14 left-1/2 -translate-x-1/2 bg-primary-600/90 backdrop-blur-sm text-white text-xs py-1.5 px-4 rounded-full font-medium shadow-lg"
				in:fly={{ y: 10, duration: 200 }}
				out:fade={{ duration: 150 }}
			>
				Copied!
			</div>
		{/if}
	</div>

	<!-- Card footer -->
	<div class="p-3.5">
		<p class="text-sm text-gray-300 line-clamp-2 mb-2.5 leading-relaxed" title={prompt}>
			{prompt}
		</p>
		<div class="flex items-center justify-between">
			<span class="text-xs text-gray-600">{formatDate(timestamp)}</span>
			<span class="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary-500/10 text-secondary-400 border border-secondary-500/20">
				${price.toFixed(priceDecimals)}
			</span>
		</div>
	</div>
</div>
