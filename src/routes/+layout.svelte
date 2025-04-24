<script lang="ts">
  import '../app.css';
  import Header from '$lib/components/Header.svelte';
</script>

<div class="min-h-screen flex flex-col">
  <Header />
  
  <main class="flex-1 container mx-auto px-4 pb-10">
    <slot />
  </main>
  
  <footer class="border-t border-gray-800 py-4 text-center text-sm text-gray-500">
    <p>GPT Image Generator | {new Date().getFullYear()}</p>
  </footer>
</div>