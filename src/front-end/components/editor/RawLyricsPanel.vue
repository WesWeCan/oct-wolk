<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { onBeforeUnmount, watch } from 'vue';

const rawLyrics = defineModel<string>('rawLyrics', { default: '' });

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
</script>

<template>
    <div class="raw-lyrics-panel">
        <div class="raw-lyrics-panel__header">
            <span class="raw-lyrics-panel__title">Raw Lyrics</span>
        </div>
        <div class="raw-lyrics-panel__editor">
            <editor-content v-if="editor" :editor="editor" />
        </div>
    </div>
</template>
