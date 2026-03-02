<script lang="ts">
	import { BarChart3, Coins, HardDrive } from 'lucide-svelte';
	import { videos, totalCost, storageStatus } from '$lib/stores/videoStore';
	import { MODEL_OPTIONS, PRICING, RESOLUTION_OPTIONS_BY_MODEL, DURATION_OPTIONS } from '$lib/types/video';

	const models = Object.keys(MODEL_OPTIONS) as (keyof typeof MODEL_OPTIONS)[];
	const durations = Object.keys(DURATION_OPTIONS).map(Number) as (keyof typeof DURATION_OPTIONS)[];
</script>

<div class="glass-effect p-5 rounded-xl">
	<div class="flex items-center mb-4">
		<BarChart3 class="h-5 w-5 text-primary-400 mr-2" />
		<h2 class="text-lg font-medium text-gray-100">Usage Statistics</h2>
	</div>

	<div class="space-y-4">
		<div class="grid grid-cols-2 gap-4">
			<div class="bg-dark-100/50 rounded-lg p-4">
				<div class="text-xs text-gray-400 mb-1">Generated Videos</div>
				<div class="text-2xl font-semibold text-gray-100">{$videos.length}</div>
			</div>

			<div class="bg-dark-100/50 rounded-lg p-4">
				<div class="text-xs text-gray-400 mb-1">Total Cost</div>
				<div class="text-2xl font-semibold text-gray-100">${$totalCost.toFixed(2)}</div>
			</div>
		</div>

		<!-- Storage Section -->
		{#if $storageStatus}
			<div class="bg-dark-100/50 rounded-lg p-4">
				<div class="flex items-center mb-3">
					<HardDrive class="h-4 w-4 text-info-400 mr-2" />
					<div class="text-xs text-gray-400">Storage Usage</div>
					<div class="ml-auto text-xs text-gray-500">{$storageStatus.sizeMB.toFixed(1)}MB / 100MB</div>
				</div>

				<div class="space-y-2">
					<div class="w-full bg-dark-200/60 rounded-full h-2">
						<div
							class="h-2 rounded-full transition-all duration-300 {$storageStatus.isOverLimit ? 'bg-error-500' : $storageStatus.isNearLimit ? 'bg-warning-500' : 'bg-success-500'}"
							style="width: {$storageStatus.percentage}%"
						></div>
					</div>

					{#if $storageStatus.isNearLimit}
						<div class="text-xs text-warning-400 flex items-center">
							⚠️ Approaching storage limit ({$storageStatus.percentage.toFixed(1)}%)
						</div>
					{:else if $storageStatus.isOverLimit}
						<div class="text-xs text-error-400 flex items-center">
							🚨 Storage limit exceeded! Old videos will be automatically deleted.
						</div>
					{:else}
						<div class="text-xs text-gray-500">
							{$storageStatus.percentage.toFixed(1)}% used
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Pricing Section -->
		<div class="bg-dark-100/50 rounded-lg p-4">
			<div class="flex items-center mb-3">
				<Coins class="h-4 w-4 text-warning-400 mr-2" />
				<div class="text-xs text-gray-400">Video Generation Pricing</div>
				<div class="ml-auto text-xs text-gray-500">Per video</div>
			</div>

			<div class="space-y-5">
				{#each models as modelKey}
					{@const resolutions = Object.keys(RESOLUTION_OPTIONS_BY_MODEL[modelKey]) as (keyof typeof PRICING[typeof modelKey])[]}
					<div class="space-y-2">
						<div class="text-sm font-medium text-gray-300">{MODEL_OPTIONS[modelKey].label}</div>
						<!-- Header row -->
						<div class="grid gap-1.5 text-xs text-gray-500" style="grid-template-columns: auto repeat({durations.length}, 1fr)">
							<div></div>
							{#each durations as d}
								<div class="text-center">{DURATION_OPTIONS[d].label}</div>
							{/each}
						</div>
						<!-- Data rows -->
						{#each resolutions as res}
							<div class="grid gap-1.5" style="grid-template-columns: auto repeat({durations.length}, 1fr)">
								<div class="text-xs text-gray-400 flex items-center">{(RESOLUTION_OPTIONS_BY_MODEL[modelKey] as any)[res].label}</div>
								{#each durations as d}
									<div class="bg-dark-200/60 rounded-sm p-2 text-center">
										<span class="text-sm font-semibold text-gray-100">
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
