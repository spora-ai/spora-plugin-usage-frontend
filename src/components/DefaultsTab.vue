<script setup lang="ts">
/**
 * The defaults: the limits that hold a principal nobody configured.
 *
 * The panel is about the three scopes of the default — everyone, users,
 * groups — and it saves them together, because the server replaces the
 * whole object at once: a scope in the payload is replaced whole, and a
 * scope that is not in the payload is left as it is. One button for the
 * three sections says exactly that.
 */
import { computed, onMounted, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { PluginHostContext } from '../shims'
import type {
    DefaultLimitScope,
    UsageDefaultsResponse,
    UsageLimitDraft,
    UsageLimitRow,
} from '../types'
import { defaultsPath } from '../lib/usage-api'
import { isForbidden, messageOf } from '../lib/errors'
import { toDefaultLimits } from '../lib/defaults'
import { useUsageStore } from '../stores/usage'
import LimitRowEditor from './LimitRowEditor.vue'

const props = defineProps<{ hostContext: PluginHostContext; idPrefix: string }>()

const { t, locale } = useI18n()
const store = useUsageStore()

const rows = ref<Record<DefaultLimitScope, UsageLimitDraft[]>>({
    all: [],
    user: [],
    group: [],
})
const saving = ref(false)
const saveError = ref<string | null>(null)
const saved = ref(false)

/**
 * The three sections, in the order they are read.
 *
 * Each one says what it covers, because "everyone" and "users" read like
 * two ways of saying the same thing until somebody says which one wins.
 */
const sections = computed(() => [
    {
        scope: 'all' as const,
        title: t('Everyone'),
        description: t('Every principal that has no limits of their own.'),
    },
    {
        scope: 'user' as const,
        title: t('Users'),
        description: t('The principals of a user. Replaces the general default for users.'),
    },
    {
        scope: 'group' as const,
        title: t('Groups'),
        description: t('The principals of a group. Replaces the general default for groups.'),
    },
])

/**
 * A stored row as the editor holds it.
 *
 * A default carries no figures: the server computes the spend per window
 * and per principal, and a default governs principals nobody configured.
 */
function toDraft(row: UsageLimitRow): UsageLimitDraft {
    return { ...row, spend: null, remaining: null }
}

/**
 * The row without the figures the editor holds for it.
 */
function toInput(draft: UsageLimitDraft): UsageLimitRow {
    return {
        window: draft.window,
        window_size: draft.window_size,
        unit: draft.unit,
        cap: draft.cap,
        mode: draft.mode,
        enabled: draft.enabled,
    }
}

/**
 * The rows on screen, taken from the stored sets.
 *
 * The store holds the sets the server answered with, and the panel holds
 * the drafts of them: an edit is a draft until it is saved, and a save
 * writes the answer back into the store so the Limits tab names the
 * default the operator has just stored.
 */
watch(
    () => store.defaults,
    (defaults) => {
        rows.value = {
            all: defaults.all.map(toDraft),
            user: defaults.user.map(toDraft),
            group: defaults.group.map(toDraft),
        }
    },
    { immediate: true },
)

function updateRow(scope: DefaultLimitScope, index: number, limit: UsageLimitDraft): void {
    rows.value = {
        ...rows.value,
        [scope]: rows.value[scope].map((row, position) => (position === index ? limit : row)),
    }
}

/**
 * A new row starts at a cap of zero and carries no figures: the cap is
 * the operator's to type, and a default is a limit nobody has spent
 * against yet.
 */
function addRow(scope: DefaultLimitScope): void {
    rows.value = {
        ...rows.value,
        [scope]: [
            ...rows.value[scope],
            {
                window: 'month',
                window_size: 1,
                unit: 'credits',
                cap: 0,
                mode: 'hard',
                enabled: true,
                spend: null,
                remaining: null,
            },
        ],
    }
}

function removeRow(scope: DefaultLimitScope, index: number): void {
    rows.value = {
        ...rows.value,
        [scope]: rows.value[scope].filter((_row, position) => position !== index),
    }
}

/**
 * The three sets, saved together.
 *
 * The server replaces every scope the payload carries, so the payload
 * carries all three: a scope the operator emptied is emptied, and a scope
 * they left alone is written back as it was.
 */
async function save(): Promise<void> {
    saving.value = true
    saveError.value = null
    saved.value = false
    try {
        const response = await props.hostContext.api.put<UsageDefaultsResponse>(defaultsPath(), {
            defaults: {
                all: rows.value.all.map(toInput),
                user: rows.value.user.map(toInput),
                group: rows.value.group.map(toInput),
            },
        })
        store.setDefaults(toDefaultLimits(response.defaults))
        saved.value = true
    } catch (e) {
        if (isForbidden(e)) {
            store.markAdminDenied()
            return
        }
        saveError.value = messageOf(e)
    } finally {
        saving.value = false
    }
}

onMounted(() => {
    void store.loadDefaults(props.hostContext.api)
})
</script>

<template>
    <div class="flex flex-col gap-6" data-testid="usage-panel-defaults">
        <header class="flex flex-col gap-1">
            <h2 class="text-lg font-semibold">{{ t('Defaults') }}</h2>
            <p class="text-sm text-muted-foreground">
                <!-- The heading states the rule the tab exists for: a
                     principal nobody configured is held to the default
                     rather than left without a limit. -->
                {{ t('A principal with no limits of its own is held to these defaults, so nobody is left unlimited.') }}
            </p>
        </header>

        <div
            v-if="store.defaultsLoading"
            class="text-sm text-muted-foreground"
            data-testid="usage-defaults-loading"
        >
            {{ t('Loading defaults…') }}
        </div>
        <div
            v-else-if="store.defaultsError"
            class="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive"
            data-testid="usage-defaults-error"
        >
            {{ t('Failed to load defaults: {error}', { error: store.defaultsError }) }}
        </div>

        <template v-else>
            <section
                v-for="section in sections"
                :key="section.scope"
                class="flex flex-col gap-3"
                :data-testid="`usage-defaults-${section.scope}`"
            >
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <h3 class="text-sm font-semibold">{{ section.title }}</h3>
                    <button
                        type="button"
                        class="rounded-lg border border-border px-3 py-1.5 text-sm transition-colors hover:bg-muted"
                        :data-testid="`usage-defaults-${section.scope}-add`"
                        @click="addRow(section.scope)"
                    >
                        {{ t('Add limit') }}
                    </button>
                </div>
                <p class="text-xs text-muted-foreground">
                    {{ section.description }}
                </p>

                <div class="overflow-x-auto">
                    <table class="w-full text-left text-sm">
                        <thead>
                            <tr class="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                                <th class="py-2 pr-2 font-medium">{{ t('Window') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Unit') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Limit') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('Mode') }}</th>
                                <th class="py-2 pr-2 font-medium">{{ t('On') }}</th>
                                <th class="py-2" />
                            </tr>
                        </thead>
                        <tbody>
                            <LimitRowEditor
                                v-for="(row, index) in rows[section.scope]"
                                :key="index"
                                :limit="row"
                                :index="index"
                                :locale="locale"
                                :id-prefix="`${idPrefix}-defaults-${section.scope}`"
                                :test-id-prefix="`usage-defaults-${section.scope}-limit`"
                                :show-figures="false"
                                @change="updateRow(section.scope, index, $event)"
                                @remove="removeRow(section.scope, index)"
                            />
                            <tr v-if="rows[section.scope].length === 0">
                                <td colspan="6" class="py-3 text-sm text-muted-foreground">
                                    {{ t('No default limits are set.') }}
                                </td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </section>

            <div class="flex flex-wrap items-center gap-3">
                <button
                    type="button"
                    class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    :disabled="saving || !store.defaultsLoaded"
                    data-testid="usage-defaults-save"
                    @click="save"
                >
                    {{ saving ? t('Saving…') : t('Save defaults') }}
                </button>
                <span
                    v-if="saved"
                    class="text-sm text-muted-foreground"
                    data-testid="usage-defaults-saved"
                >
                    {{ t('Defaults saved.') }}
                </span>
                <span
                    v-if="saveError"
                    class="text-sm text-destructive"
                    data-testid="usage-defaults-save-error"
                >
                    {{ saveError }}
                </span>
            </div>
        </template>
    </div>
</template>
