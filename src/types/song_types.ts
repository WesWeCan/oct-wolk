export interface Song {
        id: string
        title: string
        subtitle: string
        audioSrc: string
        imageSrc: string
        lyrics: string
        wordBank: string[]
        paragraphs: string[]
        wordGroups: WordGroup[]
        createdAt: number
        updatedAt: number
}


export interface WordGroup {
    name: string
    words: string[]
    groups?: WordGroup[]
    collapsed?: boolean
    // Internal transient key to silence draggable itemKey warnings
    _uid?: string
}