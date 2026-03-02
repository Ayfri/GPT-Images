<script lang="ts">
	import { page } from '$app/state';
	import { Github, ExternalLink } from 'lucide-svelte';

	const isVideoPage = $derived(page.url.pathname.startsWith('/videos'));
	const docsUrl = $derived(
		isVideoPage
			? 'https://platform.openai.com/docs/guides/video-generation'
			: 'https://platform.openai.com/docs/guides/image-generation'
	);
</script>

<footer class="border-t border-white/6 bg-dark-300/40 backdrop-blur-sm">
	<div class="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary-500/20 to-transparent"></div>
	<div class="container mx-auto px-4 py-6 flex flex-col items-center gap-4">
		<div class="flex items-center gap-4">
			<a href="https://ayfri.com" target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 transition-colors" title="Creator">
				<span class="text-sm font-medium">Ayfri</span>
			</a>
			<div class="text-gray-700">·</div>
			<a href="https://github.com/Ayfri/GPT-Images" target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 transition-colors p-1" title="GitHub">
				<Github class="w-4 h-4" />
			</a>
			<a href={docsUrl} target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 transition-colors p-1" title="API Documentation">
				<ExternalLink class="w-4 h-4" />
			</a>
		</div>
		<p class="text-xs text-gray-600 text-center">
			GPT Generator &nbsp;·&nbsp; {new Date().getFullYear()} &nbsp;·&nbsp;
			<span class="text-primary-400 font-medium">SvelteKit</span> + <span class="text-secondary-400 font-medium">Tailwind</span>
		</p>
	</div>
</footer>
