<script lang="ts">
	import type { Snippet } from 'svelte';

	const TONES = {
		danger: 'bg-error-600 hover:bg-error-500',
		primary: 'bg-primary-600 hover:bg-primary-500'
	};

	interface Props {
		/** Content of the trigger button, usually an icon. */
		children: Snippet;
		/** Classes of the trigger button. */
		class?: string;
		confirmLabel: string;
		/** Accessible name and tooltip of the trigger button. */
		label: string;
		message: string;
		onconfirm: () => void;
		tone?: keyof typeof TONES;
	}

	let { children, class: className, confirmLabel, label, message, onconfirm, tone = 'danger' }: Props = $props();

	const id = $props.id();
</script>

<button aria-label={label} class={className} popovertarget={id} style:anchor-name="--{id}" title={label} type="button">
	{@render children()}
</button>

<!-- The panel stays `visible` because it inherits `visibility` from a card overlay that hides itself when the hover ends. -->
<div
	{id}
	aria-labelledby="{id}-message"
	class="anchored-popover visible w-max max-w-64 rounded-2xl border border-white/6 bg-dark-200 p-3 text-gray-200 shadow-xl"
	ontoggle={(event) => event.newState === 'open' && event.currentTarget.querySelector('button')?.focus()}
	popover="auto"
	role="alertdialog"
	style:position-anchor="--{id}"
>
	<p class="text-sm" id="{id}-message">{message}</p>
	<div class="mt-3 flex justify-end gap-2">
		<button class="btn-ghost rounded-lg px-3 py-1.5 text-sm" popovertarget={id} popovertargetaction="hide" type="button">Cancel</button>
		<button
			class="cursor-pointer rounded-lg px-3 py-1.5 text-sm font-medium text-white transition-colors {TONES[tone]}"
			onclick={onconfirm}
			popovertarget={id}
			popovertargetaction="hide"
			type="button"
		>
			{confirmLabel}
		</button>
	</div>
</div>
