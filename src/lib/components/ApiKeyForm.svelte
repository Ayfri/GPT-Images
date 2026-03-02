<script lang="ts">
	import { apiKey } from '$lib/stores/apiKeyStore';
	import { Key, Eye, EyeOff } from 'lucide-svelte';
	import { fly } from 'svelte/transition';

	let showApiKey = $state(false);
	let keyInput = $state($apiKey);

	function toggleVisibility() {
		showApiKey = !showApiKey;
	}

	function saveApiKey() {
		apiKey.set(keyInput);
	}
</script>

<div class="glass-panel p-5 rounded-2xl">
	<div class="flex items-center gap-3 mb-5">
		<div class="flex items-center justify-center w-8 h-8 rounded-xl bg-primary-500/15 border border-primary-500/20">
			<Key class="h-4 w-4 text-primary-400" />
		</div>
		<div>
			<h2 class="text-sm font-semibold text-gray-100">OpenAI API Key</h2>
			<p class="text-xs text-gray-600">Stored locally in your browser</p>
		</div>
		{#if $apiKey}
			<div class="ml-auto flex items-center gap-1.5 text-xs text-success-400 font-medium" in:fly={{ y: 5, duration: 300 }}>
				<span class="relative flex size-1.5">
					<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-success-400 opacity-75"></span>
					<span class="relative inline-flex rounded-full size-1.5 bg-success-400"></span>
				</span>
				Active
			</div>
		{/if}
	</div>

	<div class="space-y-3">
		<div class="relative">
			{#if showApiKey}
				<input
					type="text"
					bind:value={keyInput}
					placeholder="sk-..."
					class="input w-full pr-10 font-mono text-xs"
				/>
			{:else}
				<input
					type="password"
					bind:value={keyInput}
					placeholder="sk-..."
					class="input w-full pr-10 font-mono text-xs"
				/>
			{/if}
			<button
				aria-label={showApiKey ? "Hide API key" : "Show API key"}
				class="absolute inset-y-0 right-0 px-3 flex items-center text-gray-600 hover:text-gray-300 transition-colors cursor-pointer"
				onclick={toggleVisibility}
				type="button"
			>
				{#if showApiKey}
					<EyeOff class="h-3.5 w-3.5" />
				{:else}
					<Eye class="h-3.5 w-3.5" />
				{/if}
			</button>
		</div>

		<button
			class="btn btn-primary w-full text-sm py-2.5 disabled:opacity-40 disabled:cursor-not-allowed"
			disabled={!keyInput || keyInput === $apiKey}
			onclick={saveApiKey}
			type="button"
		>
			Save API Key
		</button>
	</div>
</div>
