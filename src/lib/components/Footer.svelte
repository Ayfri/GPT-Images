<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import GitHubIcon from '#lib/components/GitHubIcon.svelte';
</script>

<footer class="relative border-t border-white/6 bg-dark-300/40 backdrop-blur-sm">
	<div class="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary-500/20 to-transparent"></div>
	<div class="container mx-auto px-4 py-6 flex flex-col items-center gap-4">
		<div class="flex items-center gap-4">
			<span class="text-sm font-medium text-gray-400">Created by</span>
			<a href="https://ayfri.com" target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 transition-colors" title="Creator">
				<span class="text-sm font-medium">Ayfri</span>
			</a>
			<a href="https://github.com/Ayfri/GPT-Images" target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 transition-colors p-1" title="GitHub">
				<GitHubIcon size={16} />
			</a>
			<a href="https://platform.openai.com/docs/guides/image-generation" target="_blank" rel="noopener" class="text-gray-500 hover:text-gray-300 transition-colors p-1" title="API documentation">
				<ExternalLink class="w-4 h-4" />
			</a>
		</div>
		<p class="text-xs text-gray-600 text-center">
			GPT Image Generator &nbsp;·&nbsp; {new Date().getFullYear()} &nbsp;·&nbsp;
			<span class="text-primary-400 font-medium">SvelteKit</span> + <span class="text-secondary-400 font-medium">Tailwind</span>
		</p>
	</div>
</footer>
