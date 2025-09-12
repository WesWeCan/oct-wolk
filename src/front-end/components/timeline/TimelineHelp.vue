<script setup lang="ts">
import { computed } from 'vue';
import { gestureRegistry } from './gestureRegistry';

const items = computed(() => gestureRegistry.list.value);
</script>

<template>
    <div class="timeline-help">
        <div class="title">Shortcuts</div>
        <ul>
            <li v-for="g in items" :key="g.id"><span class="keys">{{ g.keys }}</span><span class="desc">{{ g.description }}</span><span class="lane" v-if="g.lane">({{ g.lane }})</span></li>
        </ul>
    </div>
</template>


