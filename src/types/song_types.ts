export interface Song {
        title: string
        subtitle: string
        audioSrc: string
        imageSrc: string
        lyrics: string
        wordBank: string[]
        paragraphs: string[]
        wordGroups: WordGroup[]
}


export interface WordGroup {
    name: string
    words: string[]
    groups?: WordGroup[]
    collapsed?: boolean
    // Internal transient key to silence draggable itemKey warnings
    _uid?: string
}