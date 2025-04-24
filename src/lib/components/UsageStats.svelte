<script lang="ts">
  import { BarChart3, Coins } from 'lucide-svelte';
  import { images, totalCost } from '$lib/stores/imageStore';
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
        <div class="text-xs text-gray-400 mb-1">Total Cost</div>
        <div class="text-2xl font-semibold text-gray-100">${$totalCost.toFixed(2)}</div>
      </div>
    </div>

    <!-- Pricing Section -->
    <div class="bg-dark-100/50 rounded-lg p-4">
      <div class="flex items-center mb-3">
        <Coins class="h-4 w-4 text-warning-400 mr-2" />
        <div class="text-xs text-gray-400">Image Generation Pricing</div>
        <div class="ml-auto text-xs text-gray-500">Per image</div>
      </div>

      <div class="space-y-4">
        <!-- Low Quality -->
        <div class="space-y-2">
          <div class="text-sm font-medium text-gray-300">Low Quality</div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1024x1024</div>
              <div class="text-lg font-semibold text-gray-100">$0.011</div>
            </div>
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1024x1536</div>
              <div class="text-lg font-semibold text-gray-100">$0.016</div>
            </div>
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1536x1024</div>
              <div class="text-lg font-semibold text-gray-100">$0.016</div>
            </div>
          </div>
        </div>

        <!-- Medium Quality -->
        <div class="space-y-2">
          <div class="text-sm font-medium text-gray-300">Medium Quality</div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1024x1024</div>
              <div class="text-lg font-semibold text-gray-100">$0.042</div>
            </div>
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1024x1536</div>
              <div class="text-lg font-semibold text-gray-100">$0.063</div>
            </div>
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1536x1024</div>
              <div class="text-lg font-semibold text-gray-100">$0.063</div>
            </div>
          </div>
        </div>

        <!-- High Quality -->
        <div class="space-y-2">
          <div class="text-sm font-medium text-gray-300">High Quality</div>
          <div class="grid grid-cols-3 gap-3">
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1024x1024</div>
              <div class="text-lg font-semibold text-gray-100">$0.167</div>
            </div>
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1024x1536</div>
              <div class="text-lg font-semibold text-gray-100">$0.25</div>
            </div>
            <div class="bg-dark-200/60 rounded p-3 text-center">
              <div class="text-xs text-gray-400">1536x1024</div>
              <div class="text-lg font-semibold text-gray-100">$0.25</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
