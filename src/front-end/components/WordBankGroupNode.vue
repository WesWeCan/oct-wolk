<script setup lang="ts">
import { ref } from 'vue'
import draggable from 'vuedraggable'
import type { WordGroup } from '@/types/song_types'

const props = defineProps<{ group: WordGroup; path: number[]; hoveredWord?: string | null }>()
const emit = defineEmits<{
    (e: 'drop-word', path: number[], word: string): void
    (e: 'remove-group', path: number[]): void
    (e: 'rename-group', path: number[]): void
    (e: 'toggle-collapsed', path: number[]): void
    (e: 'hover-word', value: string | null): void
}>()

const onWordAdded = (evt: any) => {
    const word = evt.item?.__draggable_context?.element
    if (Array.isArray((props as any).group.words) && typeof evt.newIndex === 'number') {
        ;(props as any).group.words.splice(evt.newIndex, 1)
    }
    if (typeof word === 'string') emit('drop-word', props.path, word)
}

const wordDropBuffer = ref<string[]>([])
const onWordDroppedForSubgroup = (evt: any) => {
    const dropped = evt.item?.__draggable_context?.element
    wordDropBuffer.value = []
    if (typeof dropped === 'string') {
        const grp: any = (props as any).group
        if (!Array.isArray(grp.groups)) grp.groups = []
        const idx = grp.groups.length
        grp.groups.splice(idx, 0, { name: dropped, words: [], groups: [], collapsed: false, _uid: `${Date.now()}-${Math.random()}` })
    }
}

const onRemove = () => emit('remove-group', props.path)
const onRename = () => emit('rename-group', props.path)
const onToggle = () => emit('toggle-collapsed', props.path)
</script>

<template>
    <div class="group-node">
        <div class="header">
            <button class="collapse" @click="onToggle">{{ props.group.collapsed ? '▶' : '▼' }}</button>
            <span class="name">{{ props.group.name }}</span>
            <button class="rename" @click="onRename">Rename</button>
            <button class="remove" @click="onRemove">Remove</button>
        </div>

        <div v-show="!props.group.collapsed" class="body">

            <draggable v-model="(props as any).group.words" :group="{ name: 'words', put: true }" item-key="(w:string)=>w" class="words" @add="onWordAdded">
                <template #item="{ element, index }">
                    <div class="wb-chip small" :class="{ hovered: props.hoveredWord === element }" @mouseenter="emit('hover-word', element)" @mouseleave="emit('hover-word', null)">
                        <span>{{ element }}</span>
                        <button class="rm" @click.stop="(props as any).group.words.splice(index, 1)">×</button>
                    </div>
                </template>
                <template #footer>
                    <div class="drop-hint">Drag words here</div>
                </template>
            </draggable>

            <draggable v-model="(props as any).group.groups" :group="{ name: 'groups', put: ['groups'], pull: true }" item-key="(g:any)=>g._uid || g.name" tag="div" class="children">
                <template #item="{ element, index }">
                    <WordBankGroupNode :group="element" :path="[...props.path, index]" @drop-word="(p,w)=>emit('drop-word', p, w)" @remove-group="(p)=>emit('remove-group', p)" @rename-group="(p)=>emit('rename-group', p)" @toggle-collapsed="(p)=>emit('toggle-collapsed', p)" />
                </template>
            </draggable>

            <draggable v-model="wordDropBuffer" :group="{ name: 'words', put: true, pull: false }" item-key="(w:string)=>w" class="subgroup-drop" @add="onWordDroppedForSubgroup">
                <template #item="{ element }">
                    <div style="display:none">{{ element }}</div>
                </template>
                <template #footer>
                    <div class="child-hint">Add subgroup to "{{ props.group.name }}" (drop word here)</div>
                </template>
            </draggable>

            
        </div>
    </div>
</template>


