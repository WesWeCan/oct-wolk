<script setup lang="ts">
import type { SceneRef } from '@/types/timeline_types';

const props = defineProps<{ scenes: SceneRef[]; selectedId?: string }>();
const emit = defineEmits<{
    (e: 'select', id: string): void;
    (e: 'add', type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord'): void;
}>();

const handleAdd = (type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord') => emit('add', type);

</script>

<template>
    <div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <h3>Scenes</h3>
            <div style="display:flex; gap:6px;">
                <button @click="handleAdd('wordcloud')">+ WordCloud</button>
                <button @click="handleAdd('singleWord')">+ Single Word</button>
            </div>
        </div>
        <ul>
            <li v-for="(s, idx) in scenes" :key="s.id" :style="{padding:'6px', cursor:'pointer', background: s.id===props.selectedId ? '#ccc' : 'transparent'}" @click="emit('select', s.id)">
                {{ idx + 1 }}. {{ s.name }}
            </li>
        </ul>
    </div>
    
</template>


