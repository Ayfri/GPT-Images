<script lang="ts">
	import { BarChart3, Coins } from 'lucide-svelte';
	import { totalImageCount, totalCostAll } from '$lib/stores/imageStore';
	import { MODEL_OPTIONS, PRICED_SIZE_OPTIONS, getImagePrice } from '$lib/types/image';

	const models = Object.entries(MODEL_OPTIONS) as [keyof typeof MODEL_OPTIONS, { label: string }][];
	const qualities = ['low', 'medium', 'high'] as const;
	const sizes = Object.keys(PRICED_SIZE_OPTIONS) as (keyof typeof PRICED_SIZE_OPTIONS)[];
</script>

<div class="glass-panel p-5 rounded-2xl">
	<div class="flex items-center gap-3 mb-5">
		<div class="flex items-center justify-center w-8 h-8 rounded-xl bg-accent-500/15 border border-accent-500/20">
			<BarChart3 class="h-4 w-4 text-accent-400" />
		</div>
		<h2 class="text-sm font-semibold text-gray-100">Usage Statistics</h2>
	</div>

	<div class="space-y-4">
		<!-- Stats row -->
		<div class="grid grid-cols-2 gap-3">
			<div class="rounded-xl bg-white/3 border border-white/6 p-3.5">
				<div class="text-xs text-gray-500 mb-1.5">Images generated</div>
				<div class="text-2xl font-bold text-gray-100 tabular-nums">{$totalImageCount}</div>
			</div>
			<div class="rounded-xl bg-white/3 border border-white/6 p-3.5">
				<div class="text-xs text-gray-500 mb-1.5">Total cost</div>
				<div class="text-2xl font-bold text-gray-100 tabular-nums">${$totalCostAll.toFixed(2)}</div>
			</div>
		</div>

		<!-- Pricing table -->
		<div class="rounded-xl bg-white/3 border border-white/6 p-4">
			<div class="flex items-center gap-2 mb-4">
				<Coins class="h-3.5 w-3.5 text-warning-400" />
				<span class="text-xs font-medium text-gray-400">Pricing per image</span>
			</div>

			<div class="space-y-5">
				{#each models as [modelKey, model]}
					<div class="space-y-2">
						<div class="text-xs font-semibold text-gray-300 uppercase tracking-wider">{model.label}</div>
						<!-- Header row -->
						<div class="grid grid-cols-4 gap-1 text-[10px] text-gray-600 uppercase tracking-wider mb-1">
							<div></div>
							{#each sizes as size}
								<div class="text-center">{PRICED_SIZE_OPTIONS[size].label}</div>
							{/each}
						</div>
						<!-- Data rows -->
						{#each qualities as quality}
							<div class="grid grid-cols-4 gap-1">
								<div class="text-xs text-gray-500 flex items-center capitalize">{quality}</div>
								{#each sizes as size}
									{@const price = getImagePrice(modelKey, quality, size)}
									<div class="rounded-lg bg-dark-300/60 border border-white/4 p-1.5 text-center">
										{#if price !== null}
											<span class="text-xs font-semibold text-gray-200">${price.toFixed(3)}</span>
										{:else}
											<span class="text-xs font-semibold text-gray-500">—</span>
										{/if}
									</div>
								{/each}
							</div>
						{/each}
					</div>
				{/each}
			</div>
		</div>
	</div>
</div>
