import { transliterateGreek } from '../lib/transliterate'
import { normalizeWord } from '../lib/wordCache'

interface Props {
  text: string
  showPhonetics: boolean
  onWordTap?: (word: string) => void
  stackClassName: string
  wordClassName: string
  phoneticClassName: string
  selectedWord?: string | null
  selectedClassName?: string
}

// Renders Greek text word-by-word, each word stacked above its own phonetic
// transliteration (ruby/interlinear style) so the reading stays aligned even
// when the sentence wraps across lines. Falls back to plain word spans
// (still tappable) when phonetics are turned off.
export default function InterlinearGreek({
  text, showPhonetics, onWordTap, stackClassName, wordClassName, phoneticClassName,
  selectedWord, selectedClassName,
}: Props) {
  return (
    <>
      {text.split(/(\s+)/).map((token, i) => {
        if (!token) return null
        if (/^\s+$/.test(token)) return token
        const isSelected = !!selectedWord && normalizeWord(token) === normalizeWord(selectedWord)
        return (
          <span key={i} className={stackClassName}>
            <span
              className={`${wordClassName} ${isSelected && selectedClassName ? selectedClassName : ''}`}
              onClick={onWordTap ? e => { e.stopPropagation(); onWordTap(token) } : undefined}
            >
              {token}
            </span>
            {showPhonetics && (
              <span className={phoneticClassName}>{transliterateGreek(token)}</span>
            )}
          </span>
        )
      })}
    </>
  )
}
