<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'

import { onBeforeUnmount, watch } from 'vue'
// @ts-ignore – subpath export types not resolved with current moduleResolution
import { BubbleMenu } from '@tiptap/vue-3/menus'

import { Song } from '@/types/song_types'
import WordBankHighlight from '@/front-end/extensions/WordBankHighlight'
import WordInteraction from '@/front-end/extensions/WordInteraction'
import { useWordBank } from './composables/useWordBank'


const song = defineModel<Song>('song')
const props = defineProps<{ hoveredWord?: string | null }>()
const emit = defineEmits<{ (e: 'hoverWord', value: string | null): void }>()

const { addWord, normalize } = useWordBank(song)

const editor = useEditor({
    content: (song.value?.lyrics || '').split('\n').map((line) => `<p>${line || ''}</p>`).join(''),
    onUpdate: ({ editor }) => {
        // Sync editor text back to model as plain text with newlines
        const text = editor.getText({ blockSeparator: '\n' })
        if (song.value) {
            song.value.lyrics = text
        }
    },
    extensions: [
        StarterKit.configure({
            heading: {
                levels: [1, 2],
            },
            blockquote: false,
            bulletList: false,
            horizontalRule: false,
            code: false,
            codeBlock: false,
            link: false,

        }),
        WordBankHighlight.configure({
            caseInsensitive: true,
            wholeWord: true,
        }),
        WordInteraction.configure({
            onHover: (word) => emit('hoverWord', word),
            onDoubleClickWord: (word: string) => {
                if (!song.value) return
                const trimmed = (word || '').trim()
                if (trimmed.length === 0) return
                addWord(trimmed)
            },
        }),
    ],
})

// Keep editor content in sync if lyrics change externally
watch(() => song.value?.lyrics, (newLyrics) => {
    const instance = editor.value
    if (!instance) return
    const current = instance.getText({ blockSeparator: '\n' })
    if ((newLyrics ?? '') !== current) {
        const html = (newLyrics || '').split('\n').map((line) => `<p>${line || ''}</p>`).join('')
        instance.commands.setContent(html, { emitUpdate: false })
    }
})

// Update word bank highlights whenever wordBank changes
watch(() => song.value?.wordBank, (newWords) => {
    const instance = editor.value
    if (!instance) return
    instance.commands.setWordBankHighlightWords(Array.isArray(newWords) ? newWords : [])
}, { deep: true })

// Update paragraph highlights whenever paragraphs change
watch(() => song.value?.paragraphs, (newParas) => {
    const instance = editor.value
    if (!instance) return
    instance.commands.setWordBankHighlightParagraphs(Array.isArray(newParas) ? newParas : [])
}, { deep: true })

// Initialize highlights once the editor is ready
watch(() => editor.value, (instance) => {
    if (!instance) return
    const words = song.value?.wordBank ?? []
    instance.commands.setWordBankHighlightWords(words)
    const paras = song.value?.paragraphs ?? []
    instance.commands.setWordBankHighlightParagraphs(paras)
    // Normalize current word bank once editor is ready to avoid mixed-case duplicates
    if (song.value) {
        const list = Array.isArray(song.value.wordBank) ? song.value.wordBank : []
        song.value.wordBank = Array.from(new Set(list.map((w) => normalize(w)).filter((w) => !!w)))
    }
}, { immediate: true })

// Sync hoveredWord prop (from WordBank via view) into editor hover highlights
watch(() => props.hoveredWord, (word) => {
    const instance = editor.value
    if (!instance) return
    // @ts-ignore - command added by WordInteraction extension
    instance.commands.setWordInteractionHover(word ?? null)
})


onBeforeUnmount(() => {
    if (editor.value) {
        editor.value.destroy()
    }
})


const getSelectionText = (): string => {
    const instance = editor.value
    if (!instance) return ''
    const { from, to } = instance.state.selection
    return instance.state.doc.textBetween(from, to, ' ')
}

const selectWord = () => {
    const selected = getSelectionText();
    const selectedWord : string = selected;
    if (!song.value) return
    // Allow duplicates per user request; still ignore empty strings
    const trimmed = selectedWord.trim()
    if (trimmed.length === 0) return
    addWord(trimmed)
}

const selectParagraph = () => {
    const selected = getSelectionText()
    if (!song.value) return
    const trimmed = selected.trim()
    if (trimmed.length === 0) return
    song.value.paragraphs.push(trimmed.toLowerCase())
}




</script>

<template>
    <div class="tip-tap-lyric-analyzer">
        <div v-if="editor" class="container">
            <bubble-menu :editor="editor" v-if="editor">
                <div class="bubble-menu">
                    <button @click="selectWord">
                        Add Word
                    </button>
                    <!-- <button @click="selectParagraph">
                        Add Paragraph
                    </button> -->
                </div>
            </bubble-menu>
            <editor-content :editor="editor" />
        </div>
    </div>
</template>