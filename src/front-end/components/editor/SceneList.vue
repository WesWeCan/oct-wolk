<script setup lang="ts">
import type { SceneRef } from '@/types/timeline_types';

const props = defineProps<{ scenes: SceneRef[]; selectedId?: string; currentFrame?: number; fps?: number }>();
const emit = defineEmits<{
    (e: 'select', id: string): void;
    (e: 'add', type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord'): void;
    (e: 'switchHere', payload: { frame: number }): void;
    (e: 'delete', id: string): void;
}>();

const handleAdd = (type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord') => emit('add', type);
</script>

<template>
    <div>
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px;">
            <h3>Scenes</h3>
            <div style="display:flex; gap:6px;">
                <button @click="handleAdd('wordcloud')">+ WordCloud</button>
                <button @click="handleAdd('wordSphere')">+ 3D Word Sphere</button>
                <button @click="handleAdd('singleWord')">+ Single Word</button>
            </div>
        </div>
        <ul>
            <li v-for="(s, idx) in scenes" :key="s.id" :style="{padding:'6px', cursor:'pointer', background: s.id===props.selectedId ? '#ccc' : 'transparent', display:'flex', alignItems:'center', justifyContent:'space-between', gap:'8px'}" @click="emit('select', s.id)">
                <span>{{ idx + 1 }}. {{ s.name }}</span>
                <button title="Delete scene" @click.stop="emit('delete', s.id)">Delete</button>
            </li>
        </ul>
        <div style="margin-top:8px; padding:8px; border-top:1px solid #333; font-size:12px; line-height:18px;">
            <div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:6px;">
                <div style="font-weight:600;">Controls</div>
                <button @click="() => emit('switchHere', { frame: Math.max(0, props.currentFrame||0) })">Switch active scene here</button>
            </div>
            <div>Drag scene: move</div>
            <div>Resize: drag left/right edge</div>
            <div>Adjust transition: Alt + drag edge</div>
            <div>Pan timeline: Space/Ctrl/Meta drag; Zoom: Cmd/Ctrl + wheel</div>
        </div>
    </div>
    
</template>


