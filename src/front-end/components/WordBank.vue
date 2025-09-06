<script setup lang="ts">
import { Song, WordGroup } from '@/types/song_types'
import { computed, ref } from 'vue'
import draggable from 'vuedraggable'
import WordBankGroupNode from './WordBankGroupNode.vue'

// Composables
import { useHoveredWord } from './composables/useHoveredWord'
import { useWordBank } from './composables/useWordBank'

const song = defineModel<Song>('song')

const props = defineProps<{
    hoveredWord: string | null
}>()
const emit = defineEmits<{ (e: 'hoverWord', value: string | null): void }>()

const { hoveredWord: sharedHoveredWord, setHoveredWord } = useHoveredWord()
const { addWord, removeWordEverywhere, addGroup, removeGroup, renameGroup, addWordToGroup, toggleCollapsed } = useWordBank(song)

// Inputs
const newWord = ref<string>('')
const newGroupName = ref<string>('')

// Word list ordering is user-driven (draggable)
const wordList = computed({
    get: () => song.value?.wordBank ?? [],
    set: (val: string[]) => { if (song.value) song.value.wordBank = val },
})

const confirmRemoveFromEverywhere = (word: string) => {
    if (confirm(`Remove "${word}" from WordBank and all groups?`)) {
        removeWordEverywhere(word)
    }
}

const onAddWord = () => {
    if (!newWord.value.trim()) return
    addWord(newWord.value)
    newWord.value = ''
}

const onAddRootGroup = () => {
    const name = newGroupName.value.trim()
    if (!name) return
    addGroup([], name)
    newGroupName.value = ''
}

// Drag a word chip into a group
const onDropWordToGroup = (groupPath: number[], word: string) => {
    addWordToGroup(groupPath, word)
}

const onHoverWord = (w: string | null) => {
    setHoveredWord(w)
    emit('hoverWord', w)
}

// Group tree helpers
type Path = number[]

const onRemoveGroup = (path: Path) => removeGroup(path)
const onRenameGroup = (path: Path) => {
    const current = getGroupNameByPath(path)
    const name = prompt('Rename group', current || '')
    if (name !== null) renameGroup(path, name)
}

const getGroupNameByPath = (path: Path): string | null => {
    let groups = song.value?.wordGroups ?? []
    let node: WordGroup | undefined
    for (const idx of path) {
        node = groups[idx]
        groups = node?.groups ?? []
    }
    return node?.name ?? null
}

// (GroupNode moved to WordBankGroupNode.vue)

</script>

<template>
    <div class="word-bank">
        <div class="wb-columns">
            <div class="wb-col tree">
                <div class="form-group">
                    <input type="text" v-model="newGroupName" placeholder="Add root group" />
                    <button @click="onAddRootGroup">Add</button>
                </div>

                <WordBankGroupNode
                    v-for="(group, idx) in song?.wordGroups"
                    :key="group._uid || (group._uid = group.name + '-' + idx + '-' + Date.now())"
                    :group="group"
                    :path="[idx]"
                    :hovered-word="(props.hoveredWord || sharedHoveredWord)"
                    @drop-word="onDropWordToGroup"
                    @remove-group="onRemoveGroup"
                    @rename-group="onRenameGroup"
                    @toggle-collapsed="toggleCollapsed"
                    @hover-word="onHoverWord"
                />
            </div>

            <div class="wb-col words">
                <div class="form-group">
                    <input type="text" v-model="newWord" placeholder="Add word" />
                    <button @click="onAddWord">Add</button>
                </div>

                <draggable v-model="wordList" item-key="value" :group="{ name: 'words', pull: 'clone', put: false }" :clone="(w:string)=>w" class="wb-words" tag="div">
                    <template #item="{ element }">
                        <div class="wb-chip" :class="{ hovered: (props.hoveredWord || sharedHoveredWord) === element }" @mouseenter="() => { setHoveredWord(element); emit('hoverWord', element) }" @mouseleave="() => { setHoveredWord(null); emit('hoverWord', null) }">
                            <span>{{ element }}</span>
                            <button class="rm" @click.stop="confirmRemoveFromEverywhere(element)">×</button>
                        </div>
                    </template>
                </draggable>
            </div>
        </div>
    </div>
</template>