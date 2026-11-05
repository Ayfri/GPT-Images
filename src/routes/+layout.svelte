<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
	<div class="animate-orb-1 absolute -top-32 -left-32 w-150 h-150 rounded-full opacity-20"
		style="background: radial-gradient(circle, #6366f1 0%, #4f46e5 40%, transparent 70%); filter: blur(80px);">
	</div>
	<div class="animate-orb-2 absolute -bottom-40 -right-40 w-175 h-175 rounded-full opacity-15"
		style="background: radial-gradient(circle, #14b8a6 0%, #0d9488 40%, transparent 70%); filter: blur(100px);">
	</div>
	<div class="animate-orb-3 absolute top-1/3 right-1/4 w-100 h-100 rounded-full opacity-10"
		style="background: radial-gradient(circle, #d946ef 0%, #c026d3 40%, transparent 70%); filter: blur(80px);">
	</div>
	<div class="absolute inset-0 opacity-[0.025]"
		style="background-image: linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px); background-size: 48px 48px;">
	</div>
</div>

<div class="min-h-screen flex flex-col">
	<Header />

	<main class="flex-1 container mx-auto px-4 pb-16">
		{@render children()}
	</main>

	<Footer />
</div>
