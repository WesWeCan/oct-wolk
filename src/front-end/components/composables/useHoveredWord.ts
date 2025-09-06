import { ref } from 'vue'

const hovered = ref<string | null>(null)

export function useHoveredWord() {
    return {
        hoveredWord: hovered,
        setHoveredWord: (w: string | null) => { hovered.value = w },
    }
}


