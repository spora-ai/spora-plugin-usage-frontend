<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { UsageTab } from '../types'

const props = defineProps<{
    active: UsageTab
    isAdmin: boolean
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
 */
const tabs = computed<{ id: UsageTab; label: string }[]>(() => {
    const visible: { id: UsageTab; label: string }[] = [{ id: 'overview', label: t('Overview') }]
    if (!props.isAdmin) {
        return visible
    }
    visible.push(
        { id: 'principals', label: t('Principals') },
        { id: 'limits', label: t('Limits') },
        { id: 'budget', label: t('Budget') },
        { id: 'prices', label: t('Prices') },
    )
    return visible
})
</script>

<template>
    <nav
        class="flex flex-wrap items-center gap-1 border-b border-border"
        role="tablist"
        data-testid="usage-tab-bar"
    >
        <button
            v-for="tab in tabs"
            :key="tab.id"
            type="button"
            role="tab"
            :aria-selected="tab.id === active"
            class="border-b-2 px-3 py-2 text-sm font-medium transition-colors"
            :class="tab.id === active
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'"
            :data-testid="`usage-tab-${tab.id}`"
            @click="emit('select', tab.id)"
        >
            {{ tab.label }}
        </button>
    </nav>
</template>
