<script lang="ts">
  import { BarChart3, Sparkles } from 'lucide-svelte';
  import { images } from '$lib/stores/imageStore';

  // Calculate cost based on $0.01 per image
  $: totalCost = ($images.length * 0.01).toFixed(2);
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
        <div class="text-2xl font-semibold text-gray-100">{$images.length}</div>
      </div>
      
      <div class="bg-dark-100/50 rounded-lg p-4">
        <div class="text-xs text-gray-400 mb-1">Estimated Cost</div>
        <div class="text-2xl font-semibold text-gray-100">${totalCost}</div>
      </div>
    </div>
    
    <div class="bg-dark-100/50 rounded-lg p-4">
      <div class="flex items-center">
        <Sparkles class="h-4 w-4 text-warning-400 mr-2" />
        <div class="text-xs text-gray-400">Model Information</div>
      </div>
      
      <div class="mt-2 text-sm">
        <div class="grid grid-cols-2 gap-2">
          <div class="text-gray-400">Model:</div>
          <div class="text-gray-200">gpt-image-1</div>
          
          <div class="text-gray-400">Max resolution:</div>
          <div class="text-gray-200">1024×1024</div>
          
          <div class="text-gray-400">Input tokens:</div>
          <div class="text-gray-200">$10 per 1M tokens</div>

          <div class="text-gray-400">Output tokens:</div>
          <div class="text-gray-200">$40 per 1M tokens</div>
        </div>
      </div>
    </div>
  </div>
</div>