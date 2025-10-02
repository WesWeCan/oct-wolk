<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, computed } from 'vue';

const texts: [string, string][] = [
    ["Creative", "Technologist"],
    ["Wesley", "Hartogs"],
    ["Context", "Undefined"],
];

// Combined display string of start + end (no underscore dependency)
const displayCombined = ref<string>('');
const cursorPosition = ref(-1);
const isAnimating = ref(false);
// Fixed split index when idle; we animate an active split for smooth transitions
const splitIndex = ref<number>(-1);
const previousSplitIndex = ref<number>(-1);
const targetSplitIndex = ref<number>(-1);

// Smoothly moving split during animation
const activeSplitIndex = computed(() => {
    if (!isAnimating.value) return splitIndex.value;
    const i = cursorPosition.value;
    const oldSplit = previousSplitIndex.value < 0 ? splitIndex.value : previousSplitIndex.value;
    const newSplit = targetSplitIndex.value < 0 ? splitIndex.value : targetSplitIndex.value;

    if (i < 0) return oldSplit;

    if (newSplit > oldSplit) {
        const delta = Math.min(Math.max(i - oldSplit + 1, 0), newSplit - oldSplit);
        return oldSplit + delta;
    }
    if (newSplit < oldSplit) {
        const delta = Math.min(Math.max(i - newSplit + 1, 0), oldSplit - newSplit);
        return oldSplit - delta;
    }
    return oldSplit;
});

// Split text into start and end parts for display
const textParts = computed(() => {
    const text = displayCombined.value;
    const si = activeSplitIndex.value;

    if (si < 0 || si > text.length) {
        return {
            startChars: text.split(''),
            endChars: [' '], // Keep a space to prevent collapse
        };
    }

    const start = text.substring(0, si);
    const end = text.substring(si);

    return {
        startChars: start.split(''),
        endChars: end.length ? end.split('') : [' '],
    };
});

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const animateToNewText = async (targetPair: [string, string]) => {
    if (isAnimating.value) return;
    isAnimating.value = true;
    const [targetStart, targetEnd] = targetPair;
    // Prepare split movement
    const targetSplit = targetStart.length;
    previousSplitIndex.value = splitIndex.value;
    targetSplitIndex.value = targetSplit;
    
    // Pad strings to same length
    const currentLen = displayCombined.value.length;
    const targetLen = (targetStart + targetEnd).length;
    const maxLen = Math.max(currentLen, targetLen);
    
    let current = displayCombined.value.padEnd(maxLen, ' ');
    const target = (targetStart + targetEnd).padEnd(maxLen, ' ');
    
    // Animate character by character
    for (let i = 0; i < maxLen; i++) {
        if (current[i] === target[i]) {
            cursorPosition.value = i;
            await sleep(5);
            continue;
        }
        
        cursorPosition.value = i;
        
        // Direct transition for spaces
        if (target[i] === ' ') {
            current = current.substring(0, i) + target[i] + current.substring(i + 1);
            // Do not trim during animation; trimming causes indices to shift and creates jumps
            displayCombined.value = current;
            await sleep(15);
        } else {
            // Scramble effect for letters
            for (let s = 0; s < 3; s++) {
                const randomChar = s === 2 ? target[i] : characters[Math.floor(Math.random() * characters.length)];
                current = current.substring(0, i) + randomChar + current.substring(i + 1);
                // Keep full length while animating to maintain stable slicing
                displayCombined.value = current;
                await sleep(10);
            }
            await sleep(15);
        }
    }
    
    // Snap to the exact target without padding and update the split to the new start length
    displayCombined.value = targetStart + targetEnd;
    splitIndex.value = targetSplit;
    cursorPosition.value = -1;
    isAnimating.value = false;
};

let interval: number | undefined;
let currentIndex = 2; // Start with Creative_Technologist (index 2)

onMounted(() => {
    // Make sure we start with the right text
    displayCombined.value = texts[currentIndex][0] + texts[currentIndex][1];
    splitIndex.value = texts[currentIndex][0].length;
    
    interval = setInterval(async () => {
        if (isAnimating.value) return;
        
        currentIndex = (currentIndex + 1) % texts.length;
        await animateToNewText(texts[currentIndex]);
    }, 3000);
});

onBeforeUnmount(() => {
    if (interval) clearInterval(interval);
});
</script>

<template>
    <div class="creative-technologist-logo">
        <div class="start">
            <span 
                v-for="(char, index) in textParts.startChars" 
                :key="`s-${index}`"
                class="letter"
            >
                {{ char }}
                <span v-if="cursorPosition === index" class="cursor">_</span>
            </span>
        </div>
        <div class="end">
            <span 
                v-for="(char, index) in textParts.endChars" 
                :key="`e-${index}`"
                class="letter"
                :class="{ 'invisible': char === ' ' && textParts.endChars.length === 1 }"
            >
                {{ char }}
                <span v-if="cursorPosition === textParts.startChars.length + index" class="cursor">_</span>
            </span>
        </div>
    </div>
</template>

<style lang="scss">

.creative-technologist-logo {
    font-size: inherit;
    font-family: "Ancho", sans-serif;
    font-weight: 400;
    font-style: normal;
    text-decoration: none;
    text-align: left;
    user-select: none;
    display: flex;
    flex-direction: column;
    align-items: baseline;
    justify-content: flex-start;
    color: inherit;
    white-space: nowrap;
    min-width: max-content;
    transform: translateY(0.4em);

    * {
        text-align: left;
    }
    
    .start {
        font-weight: 100;
        white-space: nowrap;
        display: flex;
        min-height: 1.5em;
        
        .letter {
            position: relative;
            display: inline-block;
            flex-shrink: 0;
            min-width: 0.05em;
            
            .cursor {
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                color: #666;
                font-size: 0.8em;
                animation: blink 1s infinite;
            }
        }
    }
    
    .end {
        font-weight: 900;
        transform: translate(0, -0.4em);
        white-space: nowrap;
        display: flex;
        min-height: 1em;
        
        .letter {
            position: relative;
            display: inline-block;
            flex-shrink: 0;
            min-width: 0.05em;
            
            &.invisible {
                visibility: hidden;
            }
            
            .cursor {
                position: absolute;
                bottom: 0;
                left: 50%;
                transform: translateX(-50%);
                color: #E4FF50;
                font-size: 0.8em;
                animation: blink 1s infinite;
            }
        }
    }
}

@keyframes blink {
    0%, 50% { opacity: 1; }
    51%, 100% { opacity: 0.3; }
}
</style>