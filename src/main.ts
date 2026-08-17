import '@google/model-viewer'
import { createApp } from 'vue'
import App from './App.vue'
import { router } from './router'
import { resolveAssetUrl } from './services/assetUrl'
import './styles/global.css'

const bundledFontStylesheet = document.createElement('link')
bundledFontStylesheet.rel = 'stylesheet'
bundledFontStylesheet.href = resolveAssetUrl(
  '/assets/fonts/lxgw-wenkai/lxgwwenkai-regular.css',
)
bundledFontStylesheet.dataset.inkstoneFont = 'lxgw-wenkai'
document.head.appendChild(bundledFontStylesheet)

document.documentElement.style.setProperty(
  '--inkstone-info-background',
  `url("${resolveAssetUrl('/assets/ui/infoBG.png')}")`,
)

createApp(App).use(router).mount('#app')
