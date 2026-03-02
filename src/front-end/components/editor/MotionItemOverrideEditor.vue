<script setup lang="ts">
import StarterKit from '@tiptap/starter-kit';
import { EditorContent, useEditor } from '@tiptap/vue-3';
import { onBeforeUnmount, watch } from 'vue';

const props = defineProps<{
    modelValue: string;
    sourceText: string;
}>();

const emit = defineEmits<{
    (e: 'update:modelValue', value: string): void;
    (e: 'reset'): void;
    (e: 'cancel'): void;
}>();

const asHtmlParagraphs = (text: string): string => {
    return (text || '')
        .split('\n')
        .map((line) => `<p>${line || ''}</p>`)
        .join('');
};

const parseInitial = (value: string, fallbackText: string): any => {
    if (!value) return asHtmlParagraphs(fallbackText);
    try {
        const json = JSON.parse(value);
        if (json && typeof json === 'object') return json;
    } catch {}
    return asHtmlParagraphs(value || fallbackText);
};

const editor = useEditor({
    content: parseInitial(props.modelValue, props.sourceText),
    extensions: [
        StarterKit.configure({
            heading: false,
            blockquote: false,
            bulletList: false,
            orderedList: false,
            horizontalRule: false,
            code: false,
            codeBlock: false,
        }),
    ],
    onUpdate: ({ editor }) => {
        emit('update:modelValue', JSON.stringify(editor.getJSON()));
    },
});

const toggle = (cmd: 'bold' | 'italic') => {
    if (!editor.value) return;
    const chain = editor.value.chain().focus();
    if (cmd === 'bold') chain.toggleBold().run();
    if (cmd === 'italic') chain.toggleItalic().run();
};

watch(() => props.modelValue, (newVal) => {
    const instance = editor.value;
    if (!instance) return;
    const current = JSON.stringify(instance.getJSON());
    if ((newVal || '') !== current) {
        instance.commands.setContent(parseInitial(newVal, props.sourceText), { emitUpdate: false });
    }
});

onBeforeUnmount(() => {
    editor.value?.destroy();
});
</script>

<template>
    <div class="motion-override-editor">
        <div class="inspector-actions" style="margin-top: 8px;">
            <button @click="toggle('bold')">Bold</button>
            <button @click="toggle('italic')">Italic</button>
            <button @click="emit('reset')">Reset to Default</button>
            <button @click="emit('cancel')">Done</button>
        </div>
        <div class="raw-lyrics-panel__editor" style="max-height: 140px;">
            <editor-content v-if="editor" :editor="editor" />
        </div>
    </div>
</template>
