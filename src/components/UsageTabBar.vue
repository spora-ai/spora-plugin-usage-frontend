<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UsageTab } from '../types'

const props = defineProps<{
    active: UsageTab
    isAdmin: boolean
    idPrefix: string
}>()

const emit = defineEmits<{
    (event: 'select', tab: UsageTab): void
}>()

const { t } = useI18n()

/**
 * The tabs the caller may open.
 *
 * The admin tabs are listed last and only for an admin: the panel hides
 * them rather than offering a tab whose every call would be refused with a
 * 403.
 *
 * A segmented control rather than an underlined tab strip: the scope
 * dropdown sits beside it in the same row, and a row of underlined tabs
 * under a dropdown reads as two unrelated things.
 */
const tabs = computed<{ id: UsageTab; label: string }[]>(() => {
    const visible: { id: UsageTab; label: string }[] = [{ id: 'overview', label: t('Overview') }]
    if (!props.isAdmin) {
        return visible
    }
    visible.push(
        { id: 'limits', label: t('Limits') },
        { id: 'budget', label: t('Budget') },
        { id: 'prices', label: t('Prices') },
    )
    return visible
})
</script>

<template>
    <nav
        class="flex flex-wrap items-center gap-0.5 rounded-lg bg-muted p-0.5"
        role="tablist"
        :aria-label="t('Sections')"
        data-testid="usage-tab-bar"
    >
        <button
            v-for="tab in tabs"
            :id="`${idPrefix}-tab-${tab.id}`"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="tab.id === active"
            :aria-controls="`${idPrefix}-panel-${tab.id}`"
            class="rounded-md px-3 py-1.5 text-xs font-medium transition-colors"
            :class="tab.id === active
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'"
            :data-testid="`usage-tab-${tab.id}`"
            @click="emit('select', tab.id)"
        >
            {{ tab.label }}
        </button>
    </nav>
</template>
