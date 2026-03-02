<script lang="ts">
	import { BarChart3, Coins, HardDrive } from 'lucide-svelte';
	import { totalVideoCount, totalCostAll, storageStatus } from '$lib/stores/videoStore';
	import { MODEL_OPTIONS, PRICING, RESOLUTION_OPTIONS_BY_MODEL, DURATION_OPTIONS } from '$lib/types/video';

	const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
	const durations = Object.keys(DURATION_OPTIONS).map(Number) as (keyof typeof DURATION_OPTIONS)[];
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
				<div class="text-xs text-gray-500 mb-1.5">Videos generated</div>
				<div class="text-2xl font-bold text-gray-100 tabular-nums">{$totalVideoCount}</div>
			</div>

			<div class="rounded-xl bg-white/3 border border-white/6 p-3.5">
				<div class="text-xs text-gray-500 mb-1.5">Total cost</div>
				<div class="text-2xl font-bold text-gray-100 tabular-nums">${$totalCostAll.toFixed(2)}</div>
			</div>
		</div>

		<!-- Storage Section -->
		{#if $storageStatus}
			<div class="rounded-xl bg-white/3 border border-white/6 p-4">
				<div class="flex items-center gap-2 mb-3">
					<HardDrive class="h-3.5 w-3.5 text-blue-400" />
					<span class="text-xs font-medium text-gray-400">Storage</span>
					<span class="ml-auto text-xs text-gray-600">{$storageStatus.sizeMB.toFixed(1)} MB / 100 MB</span>
				</div>

				<div class="space-y-2">
					<div class="w-full bg-dark-300/80 rounded-full h-1.5 overflow-hidden">
						<div
							class="h-1.5 rounded-full transition-all duration-500 {$storageStatus.isOverLimit ? 'bg-error-500' : $storageStatus.isNearLimit ? 'bg-warning-400' : 'bg-success-400'}"
							style="width: {$storageStatus.percentage}%"
						></div>
					</div>

					{#if $storageStatus.isNearLimit}
						<p class="text-xs text-warning-400">Approaching limit ({$storageStatus.percentage.toFixed(1)}%)</p>
					{:else if $storageStatus.isOverLimit}
						<p class="text-xs text-error-400">Storage limit exceeded - old videos will be auto-deleted.</p>
					{:else}
						<p class="text-xs text-gray-600">{$storageStatus.percentage.toFixed(1)}% used</p>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Pricing Section -->
		<div class="rounded-xl bg-white/3 border border-white/6 p-4">
			<div class="flex items-center gap-2 mb-4">
				<Coins class="h-3.5 w-3.5 text-warning-400" />
				<span class="text-xs font-medium text-gray-400">Pricing per video</span>
			</div>

			<div class="space-y-5">
				{#each models as modelKey}
					{@const resolutions = Object.keys(RESOLUTION_OPTIONS_BY_MODEL[modelKey]) as (keyof typeof PRICING[typeof modelKey])[]}
					<div class="space-y-2">
						<div class="text-xs font-semibold text-gray-300 uppercase tracking-wider">{MODEL_OPTIONS[modelKey].label}</div>
						<div class="grid gap-1" style="grid-template-columns: 5rem repeat({durations.length}, 1fr)">
							<div></div>
							{#each durations as d}
								<div class="text-center text-[10px] text-gray-600 uppercase tracking-wider">{DURATION_OPTIONS[d].label}</div>
							{/each}
						</div>
						{#each resolutions as res}
							<div class="grid gap-1" style="grid-template-columns: 5rem repeat({durations.length}, 1fr)">
								<div class="text-xs text-gray-500 flex items-center">{(RESOLUTION_OPTIONS_BY_MODEL[modelKey] as any)[res].label}</div>
								{#each durations as d}
									<div class="rounded-lg bg-dark-300/60 border border-white/4 p-1.5 text-center">
										<span class="text-xs font-semibold text-gray-200">
											${(PRICING[modelKey][res]?.[d] ?? 0).toFixed(2)}
										</span>
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
