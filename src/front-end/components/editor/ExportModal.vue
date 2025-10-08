<script setup lang="ts">
import { computed } from 'vue';

export interface ExportState {
    phase: 'idle' | 'preparing' | 'recording' | 'encoding' | 'complete' | 'error';
    progress: number; // 0-100
    message: string;
    error?: string;
    folderPath?: string;
}

const props = defineProps<{
    state: ExportState;
    show: boolean;
    exportMode: 'realtime' | 'frames';
}>();

const emit = defineEmits<{
    cancel: [];
    stop: [];
    retry: [];
    openFolder: [];
    close: [];
    updateExportMode: [mode: 'realtime' | 'frames'];
    start: [];
}>();

const showCloseButton = computed(() => {
    return props.state.phase === 'complete' || props.state.phase === 'error';
});

const canCancel = computed(() => {
    return props.state.phase === 'preparing' || props.state.phase === 'idle';
});

const canStart = computed(() => {
    return props.state.phase === 'idle';
});

const progressBarStyle = computed(() => {
    return {
        width: `${Math.max(0, Math.min(100, props.state.progress))}%`
    };
});
</script>

<template>
    <div v-if="show" class="export-modal-backdrop">
        <div class="export-modal">
            <div class="export-modal__header">
                <h2 class="export-modal__title">
                    <template v-if="state.phase === 'idle'">Export Video</template>
                    <template v-else-if="state.phase === 'preparing'">Preparing Export</template>
                    <template v-else-if="state.phase === 'recording'">
                        <template v-if="exportMode === 'frames'">Rendering Frames</template>
                        <template v-else>Recording Video</template>
                    </template>
                    <template v-else-if="state.phase === 'encoding'">Encoding Video</template>
                    <template v-else-if="state.phase === 'complete'">Export Complete!</template>
                    <template v-else-if="state.phase === 'error'">Export Failed</template>
                </h2>
            </div>

            <div class="export-modal__content">
                <!-- Export Mode Toggle (only show during preparation or before export) -->
                <div v-if="state.phase === 'idle' || state.phase === 'preparing'" class="export-modal__mode-selector">
                    <label class="export-modal__mode-label">Export Method:</label>
                    <div class="export-modal__mode-options">
                        <button 
                            :class="['export-modal__mode-option', { active: exportMode === 'realtime' }]"
                            @click="emit('updateExportMode', 'realtime')"
                            :disabled="state.phase !== 'idle' && state.phase !== 'preparing'"
                        >
                            <span class="mode-icon">⏺</span>
                            <span class="mode-title">Real-time</span>
                            <span class="mode-desc">Record while playing</span>
                        </button>
                        <!-- <button 
                            :class="['export-modal__mode-option', { active: exportMode === 'frames' }]"
                            @click="emit('updateExportMode', 'frames')"
                            :disabled="state.phase !== 'idle' && state.phase !== 'preparing'"
                        >
                            <span class="mode-icon">🖼</span>
                            <span class="mode-title">Frame-by-Frame</span>
                            <span class="mode-desc">Lossless, faster, no drops</span>
                        </button> -->
                    </div>
                </div>

                <!-- Progress Bar -->
                <div v-if="state.phase !== 'complete' && state.phase !== 'error' && state.phase !== 'idle'" class="export-modal__progress-container">
                    <div class="export-modal__progress-bar">
                        <div class="export-modal__progress-fill" :style="progressBarStyle"></div>
                    </div>
                    <div class="export-modal__progress-text">{{ Math.round(state.progress) }}%</div>
                </div>

                <!-- Status Message -->
                <div class="export-modal__message">{{ state.message }}</div>

                <!-- Recording Instructions -->
                <div v-if="state.phase === 'recording'" class="export-modal__instructions">
                    <template v-if="exportMode === 'realtime'">
                        <p class="export-modal__instruction-text">
                            <strong>Important:</strong> The video must play through completely for the recording to finish.
                        </p>
                        <p class="export-modal__instruction-text">
                            Do not pause or stop playback manually. The export will complete automatically.
                        </p>
                    </template>
                    <template v-else>
                        <p class="export-modal__instruction-text">
                            <strong>Rendering frames:</strong> Each frame is being rendered individually as a PNG file.
                        </p>
                        <p class="export-modal__instruction-text">
                            This method is lossless and won't drop frames. The video will be assembled once all frames are rendered.
                        </p>
                    </template>
                </div>

                <!-- Error Message -->
                <div v-if="state.phase === 'error' && state.error" class="export-modal__error">
                    {{ state.error }}
                </div>

                <!-- Complete Message -->
                <div v-if="state.phase === 'complete'" class="export-modal__complete">
                    <div class="export-modal__success-icon">✓</div>
                    <p v-if="state.folderPath" class="export-modal__folder-path">
                        <strong>Location:</strong><br/>
                        <code>{{ state.folderPath }}</code>
                    </p>
                </div>
            </div>

            <div class="export-modal__footer">
                <!-- Cancel Button -->
                <button 
                    v-if="canCancel" 
                    @click="emit('cancel')"
                    class="export-modal__button export-modal__button--secondary"
                >
                    Cancel
                </button>

                <!-- Stop Button (during recording/encoding) -->
                <button 
                    v-if="state.phase === 'recording' || state.phase === 'encoding'" 
                    @click="emit('stop')"
                    class="export-modal__button export-modal__button--danger"
                >
                    Stop Export
                </button>

                <!-- Start Export Button (idle state) -->
                <button 
                    v-if="canStart" 
                    @click="emit('start')"
                    class="export-modal__button export-modal__button--primary"
                >
                    Start Export
                </button>

                <!-- Retry Button (error state) -->
                <button 
                    v-if="state.phase === 'error'" 
                    @click="emit('retry')"
                    class="export-modal__button export-modal__button--primary"
                >
                    Retry
                </button>

                <!-- Open Folder Button (complete state) -->
                <button 
                    v-if="state.phase === 'complete' && state.folderPath" 
                    @click="emit('openFolder')"
                    class="export-modal__button export-modal__button--primary"
                >
                    Open Folder
                </button>

                <!-- Close Button -->
                <button 
                    v-if="showCloseButton" 
                    @click="emit('close')"
                    class="export-modal__button export-modal__button--secondary"
                >
                    Close
                </button>
            </div>
        </div>
    </div>
</template>

<style scoped>
.export-modal-backdrop {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
    backdrop-filter: blur(4px);
}

.export-modal {
    background: #1a1a1a;
    border: 1px solid #333;
    border-radius: 8px;
    width: 90%;
    max-width: 500px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.export-modal__header {
    padding: 20px 24px;
    border-bottom: 1px solid #333;
}

.export-modal__title {
    margin: 0;
    font-size: 20px;
    font-weight: 600;
    color: #fff;
}

.export-modal__content {
    padding: 24px;
}

.export-modal__mode-selector {
    margin-bottom: 24px;
}

.export-modal__mode-label {
    display: block;
    font-size: 13px;
    font-weight: 600;
    color: #aaa;
    margin-bottom: 12px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

.export-modal__mode-options {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
}

.export-modal__mode-option {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 12px;
    background: #2a2a2a;
    border: 2px solid #333;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.2s ease;
    gap: 4px;
}

.export-modal__mode-option:hover:not(:disabled) {
    background: #333;
    border-color: #444;
}

.export-modal__mode-option.active {
    background: rgba(0, 212, 255, 0.1);
    border-color: #00d4ff;
}

.export-modal__mode-option:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}

.export-modal__mode-option .mode-icon {
    font-size: 24px;
    margin-bottom: 4px;
}

.export-modal__mode-option .mode-title {
    font-size: 14px;
    font-weight: 600;
    color: #fff;
}

.export-modal__mode-option .mode-desc {
    font-size: 11px;
    color: #999;
}

.export-modal__mode-option.active .mode-title {
    color: #00d4ff;
}

.export-modal__mode-option.active .mode-desc {
    color: #aaa;
}

.export-modal__progress-container {
    margin-bottom: 20px;
}

.export-modal__progress-bar {
    height: 8px;
    background: #2a2a2a;
    border-radius: 4px;
    overflow: hidden;
    margin-bottom: 8px;
}

.export-modal__progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #00d4ff, #0099ff);
    border-radius: 4px;
    transition: width 0.3s ease;
}

.export-modal__progress-text {
    text-align: center;
    font-size: 14px;
    color: #999;
    font-weight: 500;
}

.export-modal__message {
    font-size: 15px;
    color: #ddd;
    margin-bottom: 16px;
    text-align: center;
}

.export-modal__instructions {
    background: rgba(0, 212, 255, 0.1);
    border: 1px solid rgba(0, 212, 255, 0.3);
    border-radius: 6px;
    padding: 16px;
    margin-top: 16px;
}

.export-modal__instruction-text {
    margin: 0;
    font-size: 13px;
    color: #bbb;
    line-height: 1.5;
}

.export-modal__instruction-text + .export-modal__instruction-text {
    margin-top: 8px;
}

.export-modal__instruction-text strong {
    color: #00d4ff;
}

.export-modal__error {
    background: rgba(255, 77, 77, 0.1);
    border: 1px solid rgba(255, 77, 77, 0.3);
    border-radius: 6px;
    padding: 16px;
    color: #ff9999;
    font-size: 14px;
    line-height: 1.5;
}

.export-modal__complete {
    text-align: center;
}

.export-modal__success-icon {
    font-size: 48px;
    color: #00ff88;
    margin-bottom: 16px;
}

.export-modal__folder-path {
    margin: 16px 0 0 0;
    font-size: 13px;
    color: #bbb;
    line-height: 1.6;
}

.export-modal__folder-path strong {
    color: #fff;
}

.export-modal__folder-path code {
    display: block;
    margin-top: 8px;
    padding: 8px 12px;
    background: #2a2a2a;
    border: 1px solid #333;
    border-radius: 4px;
    font-family: 'Courier New', Courier, monospace;
    font-size: 12px;
    color: #00d4ff;
    word-break: break-all;
}

.export-modal__footer {
    padding: 16px 24px;
    border-top: 1px solid #333;
    display: flex;
    gap: 12px;
    justify-content: flex-end;
}

.export-modal__button {
    padding: 10px 20px;
    border: none;
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s ease;
}

.export-modal__button--primary {
    background: #00d4ff;
    color: #000;
}

.export-modal__button--primary:hover {
    background: #00b8e6;
    transform: translateY(-1px);
}

.export-modal__button--primary:active {
    transform: translateY(0);
}

.export-modal__button--secondary {
    background: #333;
    color: #fff;
}

.export-modal__button--secondary:hover {
    background: #444;
}

.export-modal__button--secondary:active {
    background: #2a2a2a;
}

.export-modal__button--danger {
    background: #ff4444;
    color: #fff;
}

.export-modal__button--danger:hover {
    background: #ff6666;
    transform: translateY(-1px);
}

.export-modal__button--danger:active {
    transform: translateY(0);
    background: #dd2222;
}
</style>

