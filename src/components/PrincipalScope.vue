<script setup lang="ts">
/**
 * The scope: which principal the admin tabs are about.
 *
 * A dropdown in the shell, not a picker inside a tab. The Limits and
 * Budget tabs are about one principal, so the principal has to be on
 * screen while they are — otherwise the panel edits something whose name
 * is nowhere in sight, and picking it means a trip to another tab first.
 *
 * The menu carries the balance and the 30-day spend of each principal, so
 * the shape of the install is visible before the operator commits to one.
 *
 * **No search box.** The host's ⌘K palette already covers agents, groups
 * and chats; a second search box here would only ever see the principals
 * this install has.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Check, ChevronDown, Users } from 'lucide-vue-next'
import { useUsageStore } from '../stores/usage'
import { useUsageLabels } from '../composables/useUsageLabels'
import { formatCredits } from '../lib/format'

defineProps<{ idPrefix: string }>()

const { t, locale } = useI18n()
const labels = useUsageLabels()
const store = useUsageStore()

const open = ref(false)

const selected = computed(() => store.selectedPrincipal)

/**
 * A type glyph rather than an avatar: the host has no portrait for a
 * principal.
 */
function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter((part) => /[a-z0-9]/i.test(part))
        .slice(0, 2)
        // `[...part][0]`, not `charAt(0)`: a word can pass the filter above
        // on an ASCII letter while *starting* with an astral one ("🚀 Team"),
        // and `charAt` indexes UTF-16 units.
        .map((part) => [...part][0]!.toUpperCase())
        .join('')
}

function isUser(type: string): boolean {
    return type === 'user'
}

function choose(id: number): void {
    open.value = false
    store.selectPrincipal(id)
}
</script>

<template>
    <div class="relative shrink-0" data-testid="usage-principal-scope">
        <button
            type="button"
            class="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background pl-1.5 pr-2.5 text-sm transition-colors hover:bg-muted/50"
            aria-haspopup="menu"
            :aria-expanded="open"
            :data-testid="`${idPrefix}-scope-toggle`"
            @click="open = !open"
        >
            <span
                v-if="selected && isUser(selected.type)"
                class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
            >
                {{ selected ? initials(selected.name) : '' }}
            </span>
            <span
                v-else-if="selected"
                class="flex h-6 w-6 items-center justify-center rounded-md bg-muted text-muted-foreground"
            >
                <Users class="h-3.5 w-3.5" />
            </span>
            <span class="font-medium">
                {{ selected?.name ?? t('Choose a principal') }}
            </span>
            <ChevronDown class="h-3.5 w-3.5 text-muted-foreground" />
        </button>

        <div
            v-if="open"
            class="absolute left-0 top-11 z-40 max-h-96 w-80 overflow-y-auto rounded-xl border border-border bg-card shadow-xl"
            role="menu"
            :aria-label="t('Choose a principal')"
            :data-testid="`${idPrefix}-scope-menu`"
        >
            <p
                class="border-b border-border px-3 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground"
            >
                {{ t('Principals on this installation') }}
            </p>

            <p
                v-if="store.principals.length === 0"
                class="px-3 py-3 text-sm text-muted-foreground"
                :data-testid="`${idPrefix}-scope-empty`"
            >
                {{ t('No principals yet.') }}
            </p>

            <button
                v-for="principal in store.principals"
                :key="principal.id"
                type="button"
                role="menuitem"
                :aria-current="store.selectedPrincipalId === principal.id ? 'true' : undefined"
                class="flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors hover:bg-muted"
                :class="store.selectedPrincipalId === principal.id
                    ? 'bg-muted ring-1 ring-inset ring-border'
                    : ''"
                :data-testid="`${idPrefix}-scope-option-${principal.id}`"
                @click="choose(principal.id)"
            >
                <span
                    v-if="isUser(principal.type)"
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary text-[11px] font-semibold text-primary-foreground"
                >
                    {{ initials(principal.name) }}
                </span>
                <span
                    v-else
                    class="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"
                >
                    <Users class="h-3.5 w-3.5" />
                </span>
                <span class="min-w-0 flex-1">
                    <span class="block truncate text-sm font-medium">{{ principal.name }}</span>
                    <span class="block text-[11px] text-muted-foreground">
                        {{ labels.principalTypeLabel[principal.type] }}
                    </span>
                </span>
                <span class="shrink-0 text-right text-[11px] text-muted-foreground">
                    <span class="block">
                        {{ principal.balance === null
                            ? t('No credit pool')
                            : formatCredits(principal.balance, locale) }}
                    </span>
                    <span class="block">
                        {{ t('{amount} in 30 days', { amount: formatCredits(principal.spend_30d, locale) }) }}
                    </span>
                </span>
                <Check
                    v-if="store.selectedPrincipalId === principal.id"
                    class="h-3.5 w-3.5 shrink-0"
                />
            </button>
        </div>
    </div>
</template>
