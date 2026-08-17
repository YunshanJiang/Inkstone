<script setup lang="ts">
import type { CatalogItemSummary } from '@/domain/catalog/types'

defineProps<{
  open: boolean
  items: CatalogItemSummary[]
  selectedId: string | null
  query: string
}>()

const emit = defineEmits<{
  close: []
  select: [id: string]
  'update:query': [value: string]
}>()
</script>

<template>
  <Transition name="drawer-fade">
    <div v-if="open" class="directory-layer">
      <button class="directory-backdrop" type="button" aria-label="关闭目录" @click="emit('close')" />
      <aside class="directory-drawer" aria-label="砚台目录">
        <header class="directory-header">
          <button class="directory-back" type="button" aria-label="关闭目录" @click="emit('close')">
            <img src="/assets/ui/backArrow.png" alt="">
            <span>关闭</span>
          </button>
        </header>

        <label class="directory-search">
          <input
            :value="query"
            type="search"
            aria-label="检索编号或名称"
            placeholder="编号搜索"
            @input="emit('update:query', ($event.target as HTMLInputElement).value)"
          />
        </label>

        <div class="directory-list" role="listbox" aria-label="砚台列表">
          <button
            v-for="item in items"
            :key="item.id"
            class="directory-entry"
            :class="{ 'is-selected': item.id === selectedId }"
            type="button"
            role="option"
            :aria-selected="item.id === selectedId"
            @click="emit('select', item.id)"
          >
            <span class="directory-entry__id">{{ item.id }}</span>
            <span class="directory-entry__title">{{ item.title }}</span>
          </button>
          <p v-if="items.length === 0" class="directory-empty">没有匹配的展件</p>
        </div>
      </aside>
    </div>
  </Transition>
</template>
