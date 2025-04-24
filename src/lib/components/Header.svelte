<script lang="ts">
  import logo from '../../assets/logo.png';
</script>

<header class="py-4 px-5 lg:px-6 border-b border-gray-800 mb-6 sticky top-0 z-10 glass-effect">
  <div class="container mx-auto flex justify-between items-center">
    <div class="flex items-center space-x-3">
      <img src={logo} alt="logo" class="size-10"/>
      <div>
        <h1 class="text-xl font-bold bg-gradient-to-r from-accent-400 to-secondary-400 bg-clip-text text-transparent">
          GPT Image Generator
        </h1>
        <p class="text-xs text-gray-400">Powered by OpenAI</p>
      </div>
    </div>

    <div>
      <a
        href="https://platform.openai.com/docs/guides/image-generation"
        target="_blank"
        rel="noopener noreferrer"
        class="text-sm text-gray-400 hover:text-primary-400 transition-colors"
      >
        API Docs
      </a>
    </div>
  </div>
</header>
