import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

type WordBankHighlightOptions = {
  caseInsensitive: boolean
  wholeWord: boolean
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    wordBankHighlight: {
      setWordBankHighlightWords: (words: string[]) => ReturnType
      setWordBankHighlightParagraphs: (paragraphs: string[]) => ReturnType
    }
  }
}

const wordBankHighlightPluginKey = new PluginKey('wordBankHighlight')

function escapeRegExp(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function buildRegex(words: string[], options: WordBankHighlightOptions): RegExp | null {
  const sanitized = words
    .filter((w) => typeof w === 'string')
    .map((w) => w.trim())
    .filter((w) => w.length > 0)

  if (sanitized.length === 0) return null

  // De-duplicate to avoid redundant alternations in the regex.
  const unique = Array.from(new Set(sanitized.map((w) => escapeRegExp(w))))

  const alternation = unique.join('|')
  const boundary = options.wholeWord ? '\\b' : ''
  const flags = options.caseInsensitive ? 'gi' : 'g'
  return new RegExp(`${boundary}(?:${alternation})${boundary}`, flags)
}

type Range = { from: number; to: number; kind: 'word' | 'para' }

function buildWordRanges(doc: any, regex: RegExp): Range[] {
  const decorations: any[] = []
  const ranges: Range[] = []

  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return true
    const text: string = node.text || ''
    if (!text) return true

    let match: RegExpExecArray | null
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const start = pos + match.index
      const end = start + match[0].length
      ranges.push({ from: start, to: end, kind: 'word' })
      if (match.index === regex.lastIndex) {
        regex.lastIndex++ // Avoid zero-length match infinite loops
      }
    }

    return true
  })
  return ranges
}

function buildParagraphRanges(doc: any, paragraphs: string[], caseInsensitive: boolean): Range[] {
  const ranges: Range[] = []
  const sanitized = paragraphs
    .filter((p) => typeof p === 'string')
    .map((p) => p.trim())
    .filter((p) => p.length > 0)
  if (sanitized.length === 0) return ranges

  const flags = caseInsensitive ? 'gi' : 'g'
  const regexes = sanitized.map((p) => new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags))

  doc.descendants((node: any, pos: number) => {
    if (!node.isBlock) return true
    const blockText: string = node.textBetween(0, node.content.size, '\n', '\n')
    if (!blockText) return true
    const blockStart = pos + 1 // content starts after the opening token
    for (const re of regexes) {
      let match: RegExpExecArray | null
      re.lastIndex = 0
      while ((match = re.exec(blockText)) !== null) {
        const start = blockStart + match.index
        const end = start + match[0].length
        ranges.push({ from: start, to: end, kind: 'para' })
        if (match.index === re.lastIndex) re.lastIndex++
      }
    }
    return true
  })

  return ranges
}

function mergeRangesToDecorations(doc: any, wordRanges: Range[], paraRanges: Range[]): DecorationSet {
  type Event = { pos: number; deltaWord: number; deltaPara: number }
  const events: Event[] = []
  for (const r of wordRanges) {
    events.push({ pos: r.from, deltaWord: 1, deltaPara: 0 })
    events.push({ pos: r.to, deltaWord: -1, deltaPara: 0 })
  }
  for (const r of paraRanges) {
    events.push({ pos: r.from, deltaWord: 0, deltaPara: 1 })
    events.push({ pos: r.to, deltaWord: 0, deltaPara: -1 })
  }
  events.sort((a, b) => a.pos - b.pos)

  const decorations: any[] = []
  let wordCount = 0
  let paraCount = 0

  for (let i = 0; i < events.length - 1; i++) {
    wordCount += events[i].deltaWord
    paraCount += events[i].deltaPara
    const start = events[i].pos
    const end = events[i + 1].pos
    if (end <= start) continue
    if (wordCount > 0 || paraCount > 0) {
      let cls = ''
      if (wordCount > 0 && paraCount > 0) cls = 'wb-overlap'
      else if (paraCount > 0) cls = 'wb-para'
      else cls = 'wb-highlight'
      decorations.push(Decoration.inline(start, end, { class: cls }))
    }
  }

  return DecorationSet.create(doc, decorations)
}

export default Extension.create<WordBankHighlightOptions>({
  name: 'wordBankHighlight',

  addOptions() {
    return {
      caseInsensitive: true,
      wholeWord: true,
    }
  },

  addCommands() {
    return {
      setWordBankHighlightWords:
        (words: string[]) => ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(wordBankHighlightPluginKey, { type: 'setWords', words }))
          }
          return true
        },
      setWordBankHighlightParagraphs:
        (paragraphs: string[]) => ({ tr, dispatch }) => {
          if (dispatch) {
            dispatch(tr.setMeta(wordBankHighlightPluginKey, { type: 'setParagraphs', paragraphs }))
          }
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: wordBankHighlightPluginKey,
        state: {
          init(_, { doc }) {
            const regex = buildRegex([], options)
            const wordRanges = regex ? buildWordRanges(doc, regex) : []
            const paraRanges: Range[] = []
            const decorations = mergeRangesToDecorations(doc, wordRanges, paraRanges)
            return { decorations, words: [] as string[], paragraphs: [] as string[] }
          },
          apply(tr, pluginState: any, _oldState, newState) {
            const meta = tr.getMeta(wordBankHighlightPluginKey) as { type: string; words?: string[]; paragraphs?: string[] } | undefined
            let words = pluginState.words as string[]
            let paragraphs = pluginState.paragraphs as string[]
            let shouldRecalc = tr.docChanged

            if (meta && meta.type === 'setWords') {
              words = Array.isArray(meta.words) ? meta.words : []
              shouldRecalc = true
            }
            if (meta && meta.type === 'setParagraphs') {
              paragraphs = Array.isArray(meta.paragraphs) ? meta.paragraphs : []
              shouldRecalc = true
            }

            if (shouldRecalc) {
              const regex = buildRegex(words, options)
              const wordRanges = regex ? buildWordRanges(newState.doc, regex) : []
              const paraRanges = buildParagraphRanges(newState.doc, paragraphs, options.caseInsensitive)
              const decorations = mergeRangesToDecorations(newState.doc, wordRanges, paraRanges)
              return { decorations, words, paragraphs }
            }

            return pluginState
          },
        },
        props: {
          decorations(state) {
            // @ts-ignore - plugin state shape known above
            return this.getState(state).decorations
          },
        },
      }),
    ]
  },
})


