<script setup lang="ts">
import { computed, onBeforeUnmount, ref, type CSSProperties } from 'vue'
import type { ItemDocument } from '@/domain/catalog/types'
import { resolveAssetUrl } from '@/services/assetUrl'

const props = defineProps<{
  item: ItemDocument | null
  expanded: boolean
  notFound?: boolean
  loading?: boolean
}>()

const emit = defineEmits<{
  'set-expanded': [value: boolean]
}>()

const dragging = ref(false)
const dragOffset = ref(0)
let activePointerId: number | null = null
let dragStartY = 0
let suppressClick = false
let dragHandleElement: HTMLElement | null = null
const panelAssetUrl = resolveAssetUrl('/assets/ui/Panel.png')

const sheetStyle = computed<CSSProperties>(() => ({
  '--sheet-drag-offset': `${dragOffset.value}px`,
}))

function handlePointerDown(event: globalThis.PointerEvent): void {
  if (event.pointerType === 'mouse' && event.button !== 0) return

  event.preventDefault()
  activePointerId = event.pointerId
  dragStartY = event.clientY
  dragOffset.value = 0
  dragging.value = true
  suppressClick = false
  dragHandleElement = event.currentTarget as HTMLElement
  dragHandleElement.setPointerCapture?.(event.pointerId)
  globalThis.window.addEventListener('pointermove', handlePointerMove, { passive: false })
  globalThis.window.addEventListener('pointerup', handlePointerUp)
  globalThis.window.addEventListener('pointercancel', handlePointerCancel)
}

function handlePointerMove(event: globalThis.PointerEvent): void {
  if (event.pointerId !== activePointerId) return

  event.preventDefault()
  const rawDistance = event.clientY - dragStartY
  const movementLimit = Math.max(160, globalThis.window.innerHeight * 0.42)
  dragOffset.value = props.expanded
    ? Math.min(Math.max(rawDistance, 0), movementLimit)
    : Math.max(Math.min(rawDistance, 0), -movementLimit)

  if (Math.abs(rawDistance) > 6) suppressClick = true
}

function removePointerListeners(): void {
  globalThis.window.removeEventListener('pointermove', handlePointerMove)
  globalThis.window.removeEventListener('pointerup', handlePointerUp)
  globalThis.window.removeEventListener('pointercancel', handlePointerCancel)
}

function finishDrag(event: globalThis.PointerEvent, cancelled = false): void {
  if (event.pointerId !== activePointerId) return

  const distance = dragOffset.value
  if (!cancelled) {
    if (!props.expanded && distance <= -48) emit('set-expanded', true)
    if (props.expanded && distance >= 48) emit('set-expanded', false)
  }

  if (dragHandleElement?.hasPointerCapture?.(event.pointerId)) {
    dragHandleElement.releasePointerCapture(event.pointerId)
  }
  removePointerListeners()
  activePointerId = null
  dragHandleElement = null
  dragOffset.value = 0
  dragging.value = false
  globalThis.window.setTimeout(() => {
    suppressClick = false
  }, 0)
}

function handlePointerUp(event: globalThis.PointerEvent): void {
  finishDrag(event)
}

function handlePointerCancel(event: globalThis.PointerEvent): void {
  finishDrag(event, true)
}

function handleClick(): void {
  if (suppressClick) return
  emit('set-expanded', !props.expanded)
}

onBeforeUnmount(removePointerListeners)
</script>

<template>
  <article
    class="info-sheet"
    :class="{ 'is-expanded': expanded, 'is-dragging': dragging }"
    :style="sheetStyle"
  >
    <button
      class="sheet-handle-button"
      type="button"
      :aria-expanded="expanded"
      :aria-label="expanded ? '向下拖动收起详细信息' : '向上拖动显示详细信息'"
      @click="handleClick"
      @pointerdown="handlePointerDown"
    >
      <img class="sheet-handle" :src="panelAssetUrl" alt="">
    </button>

    <template v-if="item">
      <template v-if="expanded">
        <header class="sheet-header sheet-header--detail">
          <h1>{{ item.title }}</h1>
          <p class="sheet-item-id">{{ item.id }}</p>
        </header>

        <dl class="detail-records">
          <div v-if="item.metadata?.period" class="detail-record detail-record--period">
            <dt class="sr-only">年代</dt>
            <dd class="detail-value--marked">{{ item.metadata.period }}</dd>
          </div>

          <div v-if="item.metadata?.material" class="detail-record detail-record--material">
            <dt class="sr-only">材质</dt>
            <dd>{{ item.metadata.material }}</dd>
          </div>

          <div v-if="item.metadata?.dimensions" class="detail-record">
            <dt class="detail-label">尺寸</dt>
            <dd>{{ item.metadata.dimensions }}</dd>
          </div>

          <div v-if="item.metadata?.owner" class="detail-record">
            <dt class="detail-label">来源</dt>
            <dd>{{ item.metadata.owner }}</dd>
          </div>

          <div class="detail-record detail-record--description">
            <dt class="detail-label">藏品介绍</dt>
            <dd>
              <p
                v-for="paragraph in (item.description.length > 1 ? item.description.slice(1) : item.description)"
                :key="paragraph"
              >
                {{ paragraph }}
              </p>
            </dd>
          </div>
        </dl>
      </template>

      <template v-else>
        <header class="sheet-header">
          <h1>{{ item.title }}</h1>
        </header>

        <div v-if="item.metadata?.period || item.metadata?.material" class="sheet-facts">
          <span v-if="item.metadata?.period">{{ item.metadata.period }}</span>
          <span v-if="item.metadata?.material">{{ item.metadata.material }}</span>
        </div>

        <p class="sheet-lede">{{ item.description[0] }}</p>
      </template>
    </template>

    <div v-else-if="loading" class="sheet-empty">
      <p>正在读取展件资料</p>
    </div>

    <div v-else-if="notFound" class="sheet-empty">
      <h2>未找到这方砚台</h2>
      <p>请从目录中选择一个有效编号。</p>
    </div>

    <div v-else class="sheet-empty">
      <h2>选择一方砚台</h2>
      <p>打开目录，按编号查找展件。</p>
    </div>
  </article>
</template>
