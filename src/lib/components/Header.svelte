<script lang="ts">
	import logo from '../../assets/logo.png';
	import { page } from '$app/state';

	const isVideoPage = $derived(page.url.pathname.startsWith('/videos'));
	const docsUrl = $derived(
		isVideoPage
			? 'https://platform.openai.com/docs/guides/video-generation'
			: 'https://platform.openai.com/docs/guides/image-generation'
	);
</script>

<header class="py-3 px-5 lg:px-6 border-b border-white/6 mb-6 sticky top-0 z-10 bg-dark-300/70 backdrop-blur-xl">
	<!-- Animated gradient underline -->
	<div class="absolute bottom-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-primary-500/40 to-transparent"></div>

	<div class="container mx-auto flex items-center gap-10">
		<a href="/" class="flex items-center gap-3 group shrink-0">
			<div class="relative">
				<div class="absolute inset-0 rounded-xl bg-primary-500/20 blur-md group-hover:bg-primary-500/35 transition-all duration-300"></div>
				<div class="relative overflow-hidden h-9">
					<img src={logo} alt="logo" class="size-full object-cover"/>
				</div>
			</div>
			<div>
				<span class="text-lg font-bold gradient-text">GPT Generator</span>
			</div>
		</a>
		<!-- Nav links -->
		<nav class="flex items-center gap-1">
			<a
				href="/"
				class="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
					{page.url.pathname === '/' ? 'text-white bg-white/8' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}"
			>
				{#if page.url.pathname === '/'}
					<span class="absolute inset-0 rounded-lg ring-1 ring-primary-500/30 bg-primary-500/5"></span>
				{/if}
				<span class="relative flex items-center gap-2">
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<rect x="3" y="3" width="7" height="7" rx="1" stroke-linecap="round"/>
						<rect x="14" y="3" width="7" height="7" rx="1" stroke-linecap="round"/>
						<rect x="3" y="14" width="7" height="7" rx="1" stroke-linecap="round"/>
						<rect x="14" y="14" width="7" height="7" rx="1" stroke-linecap="round"/>
					</svg>
					Images
				</span>
			</a>
			<a
				href="/videos"
				class="relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200
					{page.url.pathname.startsWith('/videos') ? 'text-white bg-white/8' : 'text-gray-500 hover:text-gray-200 hover:bg-white/5'}"
			>
				{#if page.url.pathname.startsWith('/videos')}
					<span class="absolute inset-0 rounded-lg ring-1 ring-secondary-500/30 bg-secondary-500/5"></span>
				{/if}
				<span class="relative flex items-center gap-2">
					<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
						<polygon points="5 3 19 12 5 21 5 3" stroke-linecap="round" stroke-linejoin="round"/>
					</svg>
					Videos
				</span>
			</a>
		</nav>

		<!-- Right side actions -->
		<div class="flex items-center gap-3 ml-auto">
			<a
				href={docsUrl}
				target='_blank'
				rel='noopener noreferrer'
				class='hidden sm:flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-300 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5'
			>
				<svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
					<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" stroke-linecap="round" stroke-linejoin="round"/>
					<polyline points="15 3 21 3 21 9" stroke-linecap="round" stroke-linejoin="round"/>
					<line x1="10" y1="14" x2="21" y2="3" stroke-linecap="round"/>
				</svg>
				API Docs
			</a>
			<a
				href='https://github.com/Ayfri/GPT-Images'
				target='_blank'
				rel='noopener noreferrer'
				class='flex items-center justify-center w-8 h-8 rounded-lg text-gray-500 hover:text-gray-200 hover:bg-white/8 transition-all duration-200'
				aria-label='GitHub repository'
			>
				<svg xmlns='http://www.w3.org/2000/svg' width='18' height='18' viewBox='0 0 16 16' fill='currentColor'>
					<path
						fill-rule='evenodd'
						clip-rule='evenodd'
						d='M8 0C3.58 0 0 3.58 0 8C0 11.54 2.29 14.53 5.47 15.59C5.87 15.66 6.02 15.42 6.02 15.21C6.02 15.02 6.01 14.39 6.01 13.72C4 14.09 3.48 13.23 3.32 12.78C3.23 12.55 2.84 11.84 2.5 11.65C2.22 11.5 1.82 11.13 2.49 11.12C3.12 11.11 3.57 11.7 3.72 11.94C4.44 13.15 5.59 12.81 6.05 12.6C6.12 12.08 6.33 11.73 6.56 11.53C4.78 11.33 2.92 10.64 2.92 7.58C2.92 6.71 3.23 5.99 3.74 5.43C3.66 5.23 3.38 4.41 3.82 3.31C3.82 3.31 4.49 3.1 6.02 4.13C6.66 3.95 7.34 3.86 8.02 3.86C8.7 3.86 9.38 3.95 10.02 4.13C11.55 3.09 12.22 3.31 12.22 3.31C12.66 4.41 12.38 5.23 12.3 5.43C12.81 5.99 13.12 6.7 13.12 7.58C13.12 10.65 11.25 11.33 9.47 11.53C9.76 11.78 10.01 12.26 10.01 13.01C10.01 14.08 10 14.94 10 15.21C10 15.42 10.15 15.67 10.55 15.59C13.71 14.53 16 11.53 16 8C16 3.58 12.42 0 8 0Z'
					/>
				</svg>
			</a>
		</div>
	</div>
</header>
