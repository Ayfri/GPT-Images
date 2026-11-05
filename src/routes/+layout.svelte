<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import Header from '#lib/components/Header.svelte';
	import Footer from '#lib/components/Footer.svelte';

	let { children }: { children: Snippet } = $props();
</script>

<div class="fixed inset-0 -z-10 overflow-hidden pointer-events-none" aria-hidden="true">
	<div class="orb animate-orb-1 -top-32 -left-32 w-150 h-150 opacity-20 blur-orb from-primary-500 via-primary-600"></div>
	<div class="orb animate-orb-2 -bottom-40 -right-40 w-175 h-175 opacity-15 blur-orb-lg from-secondary-500 via-secondary-600"></div>
	<div class="orb animate-orb-3 top-1/3 right-1/4 w-100 h-100 opacity-10 blur-orb from-accent-500 via-accent-600"></div>
	<div class="grid-lines absolute inset-0"></div>
</div>

<div class="min-h-screen flex flex-col">
	<Header />

	<main class="flex-1 container mx-auto px-4 pb-16">
		{@render children()}
	</main>

	<Footer />
</div>
