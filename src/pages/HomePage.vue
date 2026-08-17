<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import DirectoryDrawer from '@/components/catalog/DirectoryDrawer.vue'
import StoneViewer from '@/components/viewer/StoneViewer.vue'
import ItemDescription from '@/components/item/ItemDescription.vue'
import { useCatalogStore } from '@/stores/catalog.store'
import { appConfig } from '@/app/config'
import { hasValidIdSyntax, normalizeQueryId } from '@/utils/query-id'
import type { ViewerPhase } from '@/domain/viewer/types'

const route = useRoute()
const router = useRouter()
const catalog = useCatalogStore()

const directoryOpen = ref(false)
const directoryQuery = ref('')
const sheetExpanded = ref(false)
const viewerPhase = ref<ViewerPhase>('idle')

const items = catalog.items
const currentItem = catalog.currentItem
const catalogStatus = catalog.status
const catalogError = catalog.error
const itemLoading = catalog.itemLoading
const selectedId = computed(() => normalizeQueryId(route.query.id))
const selectedSummary = computed(() => catalog.findSummary(selectedId.value))
const queryIsValid = computed(() => hasValidIdSyntax(selectedId.value))
const selectedIndex = computed(() => items.value.findIndex((item) => item.id === selectedId.value))
const canPrevious = computed(() => selectedIndex.value > 0)
const canNext = computed(() => selectedIndex.value >= 0 && selectedIndex.value < items.value.length - 1)
const directoryItems = computed(() => {
  const query = directoryQuery.value.trim().toLowerCase()
  if (!query) return items.value
  return items.value.filter((item) => {
    const searchText = [item.id, item.title, ...(item.keywords || [])].join(' ').toLowerCase()
    return searchText.includes(query)
  })
})
onMounted(() => {
  void catalog.load()
})

watch(
  () => [selectedId.value, catalogStatus.value] as const,
  ([id, status]) => {
    if (status === 'ready') void catalog.selectItem(id)
  },
  { immediate: true },
)

watch(selectedId, () => {
  sheetExpanded.value = false
})

function openDirectory(): void {
  directoryOpen.value = true
}

function closeDirectory(): void {
  directoryOpen.value = false
}

function selectItem(id: string): void {
  directoryOpen.value = false
  directoryQuery.value = ''
  sheetExpanded.value = false
  void router.replace({ name: 'home', query: { id } })
}

function navigateItem(direction: -1 | 1): void {
  const nextIndex = selectedIndex.value + direction
  const nextItem = items.value[nextIndex]
  if (nextItem) selectItem(nextItem.id)
}

function retryCatalog(): void {
  void catalog.load()
}
</script>

<template>
  <div
    class="archive-app"
    :class="{
      'is-detail-open': sheetExpanded,
      'is-viewer-loading': viewerPhase === 'loading',
      'is-directory-open': directoryOpen,
    }"
    :data-viewer-phase="viewerPhase"
  >
    <DirectoryDrawer
      :open="directoryOpen"
      :items="directoryItems"
      :selected-id="selectedId"
      :query="directoryQuery"
      @close="closeDirectory"
      @select="selectItem"
      @update:query="directoryQuery = $event"
    />

    <header class="archive-header">
      <div class="header-object-id">
        <span>{{ selectedSummary?.id || (selectedId || 'NO OBJECT') }}</span>
      </div>

      <button
        v-if="!sheetExpanded"
        class="directory-trigger"
        type="button"
        @click="openDirectory"
      >
        目录
      </button>
    </header>

    <main class="archive-main">
      <div v-if="catalogStatus === 'error'" class="catalog-error-banner" role="alert">
        <span>{{ catalogError?.message || '目录加载失败' }}</span>
        <button type="button" @click="retryCatalog">重试</button>
      </div>

      <section class="experience-shell">
        <div class="experience-stage">
          <StoneViewer
            :item="currentItem"
            :load-timeout-ms="appConfig.modelLoadTimeoutMs"
            :can-previous="canPrevious"
            :can-next="canNext"
            @phase-change="viewerPhase = $event"
            @previous="navigateItem(-1)"
            @next="navigateItem(1)"
          />
        </div>

        <ItemDescription
          v-if="viewerPhase !== 'loading'"
          :item="currentItem"
          :expanded="sheetExpanded"
          :not-found="Boolean(selectedId && (!queryIsValid || !selectedSummary))"
          :loading="itemLoading"
          @set-expanded="sheetExpanded = $event"
        />
      </section>
    </main>
  </div>
</template>
