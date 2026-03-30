<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { computed, onBeforeUnmount, watch } from 'vue';
import { VerseLineGuides } from '@/front-end/extensions/VerseLineGuides';
import type { LyricTrack } from '@/types/project_types';

const rawLyrics = defineModel<string>('rawLyrics', { default: '' });

const props = defineProps<{
    tracks?: LyricTrack[];
}>();

const editor = useEditor({
    content: (rawLyrics.value || '').split('\n').map((line) => `<p>${line || ''}</p>`).join(''),
    onUpdate: ({ editor }) => {
        rawLyrics.value = editor.getText({ blockSeparator: '\n' });
    },
    extensions: [
        StarterKit.configure({
            heading: { levels: [1, 2] },
            blockquote: false,
            bulletList: false,
            horizontalRule: false,
            code: false,
            codeBlock: false,
        }),
        VerseLineGuides,
    ],
});

watch(rawLyrics, (newVal) => {
    const instance = editor.value;
    if (!instance) return;
    const current = instance.getText({ blockSeparator: '\n' });
    if ((newVal ?? '') !== current) {
        const html = (newVal || '').split('\n').map((line) => `<p>${line || ''}</p>`).join('');
        instance.commands.setContent(html, { emitUpdate: false });
    }
});

onBeforeUnmount(() => {
    editor.value?.destroy();
});

const firstTrackColor = (kind: LyricTrack['kind'], fallback: string) => {
    return props.tracks?.find((track) => track.kind === kind)?.color || fallback;
};

const guideStyle = computed(() => ({
    '--raw-lyrics-verse-color': firstTrackColor('verse', '#e57373'),
    '--raw-lyrics-line-color': firstTrackColor('sentence', '#81c784'),
    '--raw-lyrics-word-color': firstTrackColor('word', '#4fc3f7'),
}));
</script>

<template>
    <details class="raw-lyrics-panel" open :style="guideStyle">
        <summary class="raw-lyrics-panel__header">
            <span class="raw-lyrics-panel__title">Raw Lyrics</span>
        </summary>
        <div class="raw-lyrics-panel__body">
        <div class="raw-lyrics-panel__editor">
            <editor-content v-if="editor" :editor="editor" />
        </div>
        </div>
    </details>
</template>
