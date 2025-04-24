<script lang="ts">
  import { apiKey } from '$lib/stores/apiKeyStore';
  import { Key, Eye, EyeOff } from 'lucide-svelte';
  import { fly } from 'svelte/transition';
  
  let showApiKey = false;
  let keyInput = $apiKey;
  
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
        type="button" 
        class="absolute inset-y-0 right-0 px-3 flex items-center" 
        on:click={toggleVisibility}
        aria-label={showApiKey ? "Hide API key" : "Show API key"}
      >
        {#if showApiKey}
          <EyeOff class="h-4 w-4 text-gray-400" />
        {:else}
          <Eye class="h-4 w-4 text-gray-400" />
        {/if}
      </button>
    </div>
    
    <button 
      type="button" 
      class="btn btn-primary w-full"
      on:click={saveApiKey}
      disabled={!keyInput || keyInput === $apiKey}
    >
      Save API Key
    </button>
    
    {#if $apiKey}
      <div in:fly={{ y: 10, duration: 300 }} class="bg-success-900/20 border border-success-600/20 text-success-400 text-sm rounded-md p-2 mt-2">
        API key saved to local storage
      </div>
    {/if}
  </div>
</div>