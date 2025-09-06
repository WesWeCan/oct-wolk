import type { Ref } from 'vue'
import type { Song, WordGroup } from '@/types/song_types'

export function useWordBank(song: Ref<Song | undefined>) {
    const normalize = (input: string): string => input.trim().toLowerCase().replace(/\s+/g, ' ')

    const ensureInBank = (raw: string) => {
        const w = normalize(raw)
        if (!w) return
        const list = song.value?.wordBank
        if (!list) return
        if (!list.includes(w)) list.push(w)
    }

    const addWord = (raw: string) => {
        ensureInBank(raw)
    }

    const removeWordEverywhere = (raw: string) => {
        const w = normalize(raw)
        if (!song.value) return
        song.value.wordBank = (song.value.wordBank || []).filter((x) => x !== w)
        const walk = (groups: WordGroup[] | undefined) => {
            if (!groups) return
            for (const g of groups) {
                g.words = (g.words || []).filter((x) => x !== w)
                if (g.groups) walk(g.groups)
            }
        }
        walk(song.value.wordGroups)
    }

    const getGroup = (path: number[]): WordGroup | null => {
        let groups = song.value?.wordGroups
        let node: WordGroup | null = null
        for (const idx of path) {
            if (!groups || groups.length <= idx) return null
            node = groups[idx]
            groups = node.groups
        }
        return node
    }

    const getParent = (path: number[]): { parent: WordGroup | null; list: WordGroup[] } | null => {
        if (!song.value) return null
        if (path.length === 0) return { parent: null, list: song.value.wordGroups }
        const parentPath = path.slice(0, -1)
        if (parentPath.length === 0) return { parent: null, list: song.value.wordGroups }
        const parent = getGroup(parentPath)
        if (!parent) return null
        parent.groups = parent.groups || []
        return { parent, list: parent.groups }
    }

    const addGroup = (parentPath: number[], name: string) => {
        if (!song.value) return
        const entry = getParent(parentPath)
        if (!entry) return
        entry.list.push({ name, words: [], groups: [], collapsed: false, _uid: `${Date.now()}-${Math.random()}` })
    }

    const removeGroup = (path: number[]) => {
        if (!song.value) return
        if (path.length === 0) return
        const parentInfo = getParent(path)
        if (!parentInfo) return
        const index = path[path.length - 1]
        parentInfo.list.splice(index, 1)
    }

    const renameGroup = (path: number[], name: string) => {
        const node = getGroup(path)
        if (!node) return
        node.name = name
    }

    const toggleCollapsed = (path: number[]) => {
        const node = getGroup(path)
        if (!node) return
        node.collapsed = !node.collapsed
    }

    const addWordToGroup = (path: number[], raw: string) => {
        const node = getGroup(path)
        if (!node) return
        ensureInBank(raw)
        const w = normalize(raw)
        node.words = node.words || []
        // Ensure uniqueness within this group's words (allow same word in other groups)
        if (!node.words.includes(w)) {
            node.words.push(w)
        }
        // Defensive: deduplicate in case of pre-existing duplicates
        if (node.words.length > 1) {
            const seen = new Set<string>()
            node.words = node.words.filter((word) => {
                if (seen.has(word)) return false
                seen.add(word)
                return true
            })
        }
    }

    const removeWordFromGroup = (path: number[], raw: string) => {
        const node = getGroup(path)
        if (!node) return
        const w = normalize(raw)
        node.words = (node.words || []).filter((x) => x !== w)
    }

    return {
        normalize,
        ensureInBank,
        addWord,
        removeWordEverywhere,
        addGroup,
        removeGroup,
        renameGroup,
        toggleCollapsed,
        addWordToGroup,
        removeWordFromGroup,
        getGroup,
        getParent,
    }
}


