<script lang="ts">
	import { BarChart3, Coins } from 'lucide-svelte';
	import { totalImageCount, totalCostAll } from '$lib/stores/imageStore';
	import { MODEL_OPTIONS, QUALITY_OPTIONS, SIZE_OPTIONS, PRICING } from '$lib/types/image';

	const models = Object.entries(MODEL_OPTIONS) as [keyof typeof MODEL_OPTIONS, { label: string }][];
	const qualities = Object.keys(QUALITY_OPTIONS) as (keyof typeof QUALITY_OPTIONS)[];
	const sizes = Object.keys(SIZE_OPTIONS) as (keyof typeof SIZE_OPTIONS)[];
</script>

<div class="glass-effect p-5 rounded-xl">
	<div class="flex items-center mb-4">
		<BarChart3 class="h-5 w-5 text-primary-400 mr-2" />
		<h2 class="text-lg font-medium text-gray-100">Usage Statistics</h2>
	</div>

	<div class="space-y-4">
		<div class="grid grid-cols-2 gap-4">
			<div class="bg-dark-100/50 rounded-lg p-4">
				<div class="text-xs text-gray-400 mb-1">Generated Images</div>
				<div class="text-2xl font-semibold text-gray-100">{$totalImageCount}</div>
			</div>
			<div class="bg-dark-100/50 rounded-lg p-4">
				<div class="text-xs text-gray-400 mb-1">Total Cost</div>
				<div class="text-2xl font-semibold text-gray-100">${$totalCostAll.toFixed(2)}</div>
			</div>
		</div>

		<!-- Pricing Section -->
		<div class="bg-dark-100/50 rounded-lg p-4">
			<div class="flex items-center mb-3">
				<Coins class="h-4 w-4 text-warning-400 mr-2" />
				<div class="text-xs text-gray-400">Image Generation Pricing</div>
				<div class="ml-auto text-xs text-gray-500">Per image</div>
			</div>

			<div class="space-y-5">
				{#each models as [modelKey, model]}
					<div class="space-y-2">
						<div class="text-sm font-medium text-gray-300">{model.label}</div>
						<!-- Header row -->
						<div class="grid grid-cols-4 gap-1.5 text-xs text-gray-500">
							<div></div>
							{#each sizes as size}
								<div class="text-center">{SIZE_OPTIONS[size].label}</div>
							{/each}
						</div>
						<!-- Data rows -->
						{#each qualities as quality}
							<div class="grid grid-cols-4 gap-1.5">
								<div class="text-xs text-gray-400 flex items-center capitalize">{quality}</div>
								{#each sizes as size}
									<div class="bg-dark-200/60 rounded-sm p-2 text-center">
										<span class="text-sm font-semibold text-gray-100">
											${PRICING[modelKey][quality][size].toFixed(3)}
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
