import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

const verseLineGuidesKey = new PluginKey('verseLineGuides')

/**
 * Adds dual left-edge guides to lyric paragraphs:
 *   - Red lane   (.verse-*)  — a continuous verse block between empty lines
 *   - Green lane (.lyric-line) — every non-empty entered line
 *
 * Verse boundaries are detected by blank (empty) paragraphs — the same
 * convention used by the verse track generator.
 */
export const VerseLineGuides = Extension.create({
    name: 'verseLineGuides',

    addProseMirrorPlugins() {
        return [
            new Plugin({
                key: verseLineGuidesKey,
                props: {
                    decorations(state) {
                        const { doc } = state
                        const decorations: Decoration[] = []
                        const paragraphs: Array<{ pos: number; nodeSize: number; isEmpty: boolean }> = []

                        doc.forEach((node, pos) => {
                            if (node.type.name !== 'paragraph') return
                            paragraphs.push({
                                pos,
                                nodeSize: node.nodeSize,
                                isEmpty: node.textContent.trim().length === 0,
                            })
                        })

                        for (let i = 0; i < paragraphs.length; i++) {
                            const current = paragraphs[i]
                            if (current.isEmpty) continue

                            const prev = i > 0 ? paragraphs[i - 1] : null
                            const next = i < paragraphs.length - 1 ? paragraphs[i + 1] : null

                            const hasPrevInVerse = !!prev && !prev.isEmpty
                            const hasNextInVerse = !!next && !next.isEmpty

                            let verseClass = 'verse-mid'
                            if (!hasPrevInVerse && !hasNextInVerse) verseClass = 'verse-single'
                            else if (!hasPrevInVerse) verseClass = 'verse-start'
                            else if (!hasNextInVerse) verseClass = 'verse-end'

                            decorations.push(
                                Decoration.node(current.pos, current.pos + current.nodeSize, {
                                    class: `lyric-line ${verseClass}`,
                                }),
                            )

                            // Add per-word inline decorations so underlines do not span spaces.
                            const paragraphNode = doc.nodeAt(current.pos)
                            if (!paragraphNode) continue

                            paragraphNode.descendants((child, offset) => {
                                if (!child.isText || !child.text) return
                                const text = child.text
                                const regex = /\S+/g
                                let match: RegExpExecArray | null = null
                                while ((match = regex.exec(text)) !== null) {
                                    const from = current.pos + 1 + offset + match.index
                                    const to = from + match[0].length
                                    decorations.push(
                                        Decoration.inline(from, to, { class: 'lyric-word' }),
                                    )
                                }
                            })
                        }

                        return DecorationSet.create(doc, decorations)
                    },
                },
            }),
        ]
    },
})
