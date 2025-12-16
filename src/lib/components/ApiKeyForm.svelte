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

<div class="glass-effect p-5 rounded-xl">
	<div class="flex items-center mb-4">
		<Key class="h-5 w-5 text-primary-400 mr-2" />
		<h2 class="text-lg font-medium text-gray-100">OpenAI API Key</h2>
	</div>

	<div class="space-y-4">
		<p class="text-sm text-gray-300">
			Your API key is stored securely in your browser and never sent to our servers.
		</p>

		<div class="relative">
			{#if showApiKey}
				<input
					type="text"
					bind:value={keyInput}
					placeholder="sk-..."
					class="input w-full pr-10"
				/>
			{:else}
				<input
					type="password"
					bind:value={keyInput}
					placeholder="sk-..."
					class="input w-full pr-10"
				/>
			{/if}
			<button
				aria-label={showApiKey ? "Hide API key" : "Show API key"}
				class="absolute inset-y-0 right-0 px-3 flex items-center cursor-pointer"
				onclick={toggleVisibility}
				type="button"
			>
				{#if showApiKey}
					<EyeOff class="h-4 w-4 text-gray-400" />
				{:else}
					<Eye class="h-4 w-4 text-gray-400" />
				{/if}
			</button>
		</div>

		<button
			class="btn btn-primary w-full"
			disabled={!keyInput || keyInput === $apiKey}
			onclick={saveApiKey}
			type="button"
		>
			Save API Key
		</button>

		{#if $apiKey}
			<div class="bg-success-900/20 border border-success-600/20 text-success-400 text-sm rounded-md p-2 mt-2" in:fly={{ y: 10, duration: 300 }}>
				API key saved to local storage
			</div>
		{/if}
	</div>
</div>
