import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from 'prosemirror-state'
import { Decoration, DecorationSet } from 'prosemirror-view'

type WordInteractionOptions = {
  onHover?: (word: string | null) => void
  onDoubleClickWord?: (word: string) => void
}

const wordInteractionKey = new PluginKey('wordInteraction')

function isWordChar(ch: string): boolean {
  return /[A-Za-z0-9_']/u.test(ch)
}

function getBlockText(node: any): string {
  return node.textBetween(0, node.content.size, '\n', '\n')
}

function findWordBoundsInBlockDirectional(
  blockText: string,
  index: number,
  prefer: 'left' | 'right'
): { start: number; end: number; word: string } | null {
  const length = blockText.length
  if (length === 0) return null

  let i = Math.max(0, Math.min(index, length))

  if (i >= length) i = length - 1

  if (!isWordChar(blockText[i])) {
    if (prefer === 'right') {
      while (i < length && !isWordChar(blockText[i])) i++
      if (i >= length) return null
    } else {
      while (i >= 0 && !isWordChar(blockText[i])) i--
      if (i < 0) return null
    }
  }

  let start = i
  while (start > 0 && isWordChar(blockText[start - 1])) start--

  let end = i
  while (end < length && isWordChar(blockText[end])) end++

  const word = blockText.slice(start, end)
  if (!word) return null
  return { start, end, word }
}

function getWordAtPosDirectional(doc: any, pos: number, prefer: 'left' | 'right'):
  | { from: number; to: number; word: string }
  | null {
  const $pos = doc.resolve(pos)
  const parent = $pos.parent
  const blockStart = $pos.start()
  const blockText = getBlockText(parent)
  const localIndex = pos - blockStart
  const bounds = findWordBoundsInBlockDirectional(blockText, localIndex, prefer)
  if (!bounds) return null
  return { from: blockStart + bounds.start, to: blockStart + bounds.end, word: bounds.word }
}

function snapSelectionToWordBoundaries(doc: any, from: number, to: number): { from: number; to: number } | null {
  const forward = from <= to
  const a = forward ? from : to
  const b = forward ? to : from

  // For the start, prefer moving RIGHT to the next word if in whitespace.
  const aInfo = getWordAtPosDirectional(doc, a, 'right')
  // For the end, prefer moving LEFT to the previous word if in whitespace.
  const bInfo = getWordAtPosDirectional(doc, b, 'left')
  if (!aInfo || !bInfo) return null

  const snapped = { from: aInfo.from, to: bInfo.to }
  return snapped
}

function buildHoverRegex(word: string | null): RegExp | null {
  if (!word) return null
  const escaped = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`\\b${escaped}\\b`, 'gi')
}

function buildHoverDecorations(doc: any, regex: RegExp): DecorationSet {
  const decorations: any[] = []
  doc.descendants((node: any, pos: number) => {
    if (!node.isText) return true
    const text: string = node.text || ''
    if (!text) return true
    let match: RegExpExecArray | null
    regex.lastIndex = 0
    while ((match = regex.exec(text)) !== null) {
      const start = pos + match.index
      const end = start + match[0].length
      decorations.push(Decoration.inline(start, end, { class: 'wb-hover' }))
      if (match.index === regex.lastIndex) regex.lastIndex++
    }
    return true
  })
  return DecorationSet.create(doc, decorations)
}

export default Extension.create<WordInteractionOptions>({
  name: 'wordInteraction',

  addOptions() {
    return {
      onHover: undefined,
      onDoubleClickWord: undefined,
    }
  },

  addCommands() {
    return {
      setWordInteractionHover:
        (word: string | null) => ({ state, dispatch }) => {
          if (!dispatch) return false
          const tr = state.tr.setMeta(wordInteractionKey, { type: 'setHover', word })
          dispatch(tr)
          return true
        },
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        key: wordInteractionKey,
        state: {
          init(_config, { doc }) {
            return { hoveredWord: null as string | null, decorations: DecorationSet.empty }
          },
          apply(tr, pluginState: any, _old, state) {
            const meta = tr.getMeta(wordInteractionKey) as { type: string; word?: string | null } | undefined
            let hoveredWord = pluginState.hoveredWord as string | null
            let decorations = pluginState.decorations as DecorationSet

            let shouldRecalc = tr.docChanged

            if (meta && meta.type === 'setHover') {
              hoveredWord = meta.word ?? null
              shouldRecalc = true
            }

            if (shouldRecalc) {
              const regex = buildHoverRegex(hoveredWord)
              decorations = regex ? buildHoverDecorations(state.doc, regex) : DecorationSet.empty
            }

            return { hoveredWord, decorations }
          },
        },
        props: {
          decorations(state) {
            // @ts-ignore
            return this.getState(state).decorations
          },
          handleDOMEvents: {
            mousemove: (view, event) => {
              // Throttle and only update on word change to avoid overload
              // These variables are closed over per plugin instance
              // @ts-ignore
              if (!view.__wbHover) view.__wbHover = { lastWord: null as string | null, lastTs: 0 }
              // @ts-ignore
              const hoverState = view.__wbHover as { lastWord: string | null; lastTs: number }
              const now = performance.now()
              const throttleMs = 80
              if (now - hoverState.lastTs < throttleMs) return false
              const e = event as MouseEvent
              const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
              if (!pos) {
                if (hoverState.lastWord !== null) {
                  hoverState.lastWord = null
                  hoverState.lastTs = now
                  if (options.onHover) options.onHover(null)
                  const tr = view.state.tr.setMeta(wordInteractionKey, { type: 'setHover', word: null })
                  view.dispatch(tr)
                }
                return false
              }
              const info = getWordAtPosDirectional(view.state.doc, pos.pos, 'right')
              const word = info?.word ?? null
              if (word === hoverState.lastWord) return false
              hoverState.lastWord = word
              hoverState.lastTs = now
              if (options.onHover) options.onHover(word)
              const tr = view.state.tr.setMeta(wordInteractionKey, { type: 'setHover', word })
              view.dispatch(tr)
              return false
            },
            mouseleave: (view, _event) => {
              // @ts-ignore
              if (!view.__wbHover) view.__wbHover = { lastWord: null as string | null, lastTs: 0 }
              // @ts-ignore
              const hoverState = view.__wbHover as { lastWord: string | null; lastTs: number }
              if (hoverState.lastWord !== null) {
                hoverState.lastWord = null
                hoverState.lastTs = performance.now()
                if (options.onHover) options.onHover(null)
                const tr = view.state.tr.setMeta(wordInteractionKey, { type: 'setHover', word: null })
                view.dispatch(tr)
              }
              return false
            },
            click: (view, event) => {
              const e = event as MouseEvent
              const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
              if (!pos) return false
              const info = getWordAtPosDirectional(view.state.doc, pos.pos, 'right')
              if (!info) return false
              const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, info.from, info.to))
              view.dispatch(tr)
              return true
            },
            dblclick: (view, event) => {
              const e = event as MouseEvent
              const pos = view.posAtCoords({ left: e.clientX, top: e.clientY })
              if (!pos) return false
              const info = getWordAtPosDirectional(view.state.doc, pos.pos, 'right')
              if (!info) return false
              const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, info.from, info.to))
              view.dispatch(tr)
              if (options.onDoubleClickWord) options.onDoubleClickWord(info.word)
              return true
            },
            mouseup: (view, _event) => {
              const { from, to } = view.state.selection
              const snapped = snapSelectionToWordBoundaries(view.state.doc, from, to)
              if (!snapped) return false
              if (snapped.from === from && snapped.to === to) return false
              const tr = view.state.tr.setSelection(TextSelection.create(view.state.doc, snapped.from, snapped.to))
              view.dispatch(tr)
              return true
            },
          },
        },
      }),
    ]
  },
})


