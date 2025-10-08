<script setup lang="ts">
import { ref } from 'vue';
import type { SceneRef, SceneType } from '@/types/timeline_types';

const props = defineProps<{ scenes: SceneRef[]; selectedId?: string; currentFrame?: number; fps?: number }>();
const emit = defineEmits<{
    (e: 'select', id: string): void;
    (e: 'add', type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord' | 'model3d'): void;
    (e: 'switchHere', payload: { frame: number }): void;
    (e: 'delete', id: string): void;
    (e: 'duplicate', id: string): void;
    (e: 'rename', payload: { id: string; name: string }): void;
}>();

const showAddMenu = ref(false);
const editingSceneId = ref<string | null>(null);
const editingName = ref('');

const handleAdd = (type: 'wordcloud' | 'imageMaskFill' | 'wordSphere' | 'singleWord' | 'model3d') => {
    emit('add', type);
    showAddMenu.value = false;
};

const formatSceneType = (type: SceneType): string => {
    const typeMap: Record<SceneType, string> = {
        'wordcloud': 'WordCloud',
        'wordSphere': '3D Sphere',
        'singleWord': 'Single',
        'model3d': '3D Model',
        'imageMaskFill': 'Mask'
    };
    return typeMap[type] || type;
};

const getSceneIcon = (type: SceneType): string => {
    const iconMap: Record<SceneType, string> = {
        'wordcloud': '🌥️',
        'wordSphere': '🌐',
        'singleWord': '📝',
        'model3d': '🎭',
        'imageMaskFill': '🖼️'
    };
    return iconMap[type] || '📄';
};

const startRename = (scene: SceneRef) => {
    editingSceneId.value = scene.id;
    editingName.value = scene.name;
};

const saveRename = (id: string) => {
    if (editingName.value.trim()) {
        emit('rename', { id, name: editingName.value.trim() });
    }
    editingSceneId.value = null;
};

const cancelRename = () => {
    editingSceneId.value = null;
};
</script>

<template>
    <div class="scene-list-container">
        <div class="scene-list-header">
            <h3>SCENES</h3>
            <div class="add-scene-dropdown">
                <button @click="showAddMenu = !showAddMenu" class="primary add-scene-btn">
                    + Add Scene
                </button>
                <div v-if="showAddMenu" class="dropdown-menu">
                    <button @click="handleAdd('wordcloud')" class="dropdown-item">
                        <span class="icon">🌥️</span>
                        <span>WordCloud</span>
                    </button>
                    <button @click="handleAdd('imageMaskFill')" class="dropdown-item">
                        <span class="icon">🖼️</span>
                        <span>Portrait Mask Fill</span>
                    </button>
                    <button @click="handleAdd('wordSphere')" class="dropdown-item">
                        <span class="icon">🌐</span>
                        <span>3D Sphere</span>
                    </button>
                    <button @click="handleAdd('singleWord')" class="dropdown-item">
                        <span class="icon">📝</span>
                        <span>Single Word</span>
                    </button>
                    <button @click="handleAdd('model3d')" class="dropdown-item">
                        <span class="icon">🎭</span>
                        <span>3D Model</span>
                    </button>
                </div>
            </div>
        </div>
        
        <div v-if="scenes.length === 0" class="empty-state">
            <div class="empty-icon">🎬</div>
            <div class="empty-title">No scenes yet</div>
            <div class="empty-text">Click a button above to create your first scene</div>
        </div>
        
        <ul v-else class="scene-items">
            <li v-for="(s, idx) in scenes" :key="s.id" class="scene-item" :class="{ selected: s.id === props.selectedId }" @click="emit('select', s.id)">
                <div class="scene-main">
                    <div class="scene-icon">{{ getSceneIcon(s.type) }}</div>
                    <div class="scene-content">
                        <input 
                            v-if="editingSceneId === s.id"
                            v-model="editingName"
                            @click.stop
                            @keyup.enter="saveRename(s.id)"
                            @keyup.esc="cancelRename"
                            @blur="saveRename(s.id)"
                            class="scene-name-input"
                            ref="editInput"
                        />
                        <div v-else class="scene-name" @dblclick.stop="startRename(s)">{{ s.name }}</div>
                        <div class="scene-meta">
                            <span class="meta-item scene-index">#{{ idx + 1 }}</span>
                            <span class="meta-item scene-type">{{ formatSceneType(s.type) }}</span>
                            <span class="meta-item scene-frames">{{ s.durationFrames }}f</span>
                        </div>
                    </div>
                </div>
                <div class="scene-actions">
                    <button title="Rename scene" @click.stop="startRename(s)" class="action-btn">✏️</button>
                    <button title="Duplicate scene" @click.stop="emit('duplicate', s.id)" class="action-btn">⎘</button>
                    <button title="Delete scene" @click.stop="emit('delete', s.id)" class="danger delete-btn">×</button>
                </div>
            </li>
        </ul>
        
        <details class="timeline-controls" open>
            <summary>
                <span>TIMELINE CONTROLS</span>
            </summary>
            <div class="controls-grid">
                <div class="shortcut-box">
                    <div class="shortcut-key">Drag scene</div>
                    <div class="shortcut-desc">Move</div>
                </div>
                <div class="shortcut-box">
                    <div class="shortcut-key">Drag edge</div>
                    <div class="shortcut-desc">Resize</div>
                </div>
                <div class="shortcut-box">
                    <div class="shortcut-key">Shift-drag</div>
                    <div class="shortcut-desc">Select multiple keyframes</div>
                </div>
                <div class="shortcut-box">
                    <div class="shortcut-key">Drag bottom</div>
                    <div class="shortcut-desc">Resize lane</div>
                </div>
                <div class="shortcut-box">
                    <div class="shortcut-key">⌘ + wheel</div>
                    <div class="shortcut-desc">Zoom</div>
                </div>
            </div>
        </details>
    </div>
</template>


