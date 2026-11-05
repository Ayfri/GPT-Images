<script lang="ts">
	import { ExternalLink } from '@lucide/svelte';
	import GitHubIcon from '#lib/components/GitHubIcon.svelte';
</script>

<header class="py-2 px-3 sm:py-3 sm:px-4 md:px-5 lg:px-6 border-b border-white/6 mb-6 sticky top-0 z-10 bg-dark-300/70 backdrop-blur-xl">
	<div class="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary-500/40 to-transparent"></div>

	<div class="container mx-auto flex items-center gap-3 sm:gap-6 md:gap-8 lg:gap-10">
		<a href="/" class="flex items-center gap-2 sm:gap-3 group shrink-0">
			<div class="relative">
				<div class="absolute inset-0 rounded-xl bg-primary-500/20 blur-md group-hover:bg-primary-500/35 transition-all duration-300"></div>
				<div class="relative overflow-hidden h-8 sm:h-9">
					<!-- display: contents keeps the img sized by the wrapper, so the <picture> adds no box. -->
					<picture class="contents">
						<source srcset="/logo.avif" type="image/avif" />
						<img src="/logo.png" alt="" width="103" height="96" class="size-full object-cover" />
					</picture>
				</div>
			</div>
			<div>
				<span class="text-base sm:text-lg font-bold gradient-text whitespace-nowrap">GPT Image Generator</span>
			</div>
		</a>
		<div class="flex items-center gap-1 sm:gap-2 md:gap-3 ml-auto">
			<a
				href='https://platform.openai.com/docs/guides/image-generation'
				target='_blank'
				rel='noopener noreferrer'
				class='hidden sm:flex items-center gap-1 sm:gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 sm:px-3 py-1.5 rounded-lg hover:bg-white/5'
			>
				<ExternalLink class="w-3.5 h-3.5" />
				API docs
			</a>
			<a
				href='https://github.com/Ayfri/GPT-Images'
				target='_blank'
				rel='noopener noreferrer'
				class='flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-all duration-200'
				aria-label='GitHub repository'
			>
				<GitHubIcon size={18} />
			</a>
		</div>
	</div>
</header>
