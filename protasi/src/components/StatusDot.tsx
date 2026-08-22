import { getLearningStatus, STATUS_COLOR, STATUS_LABEL } from '../lib/mastery'
import type { Sentence } from '../types'

interface Props {
  sentence: Sentence
  size?: number
}

export default function StatusDot({ sentence, size = 8 }: Props) {
  const status = getLearningStatus(sentence)
  return (
    <span
      title={STATUS_LABEL[status]}
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        borderRadius: '50%',
        background: STATUS_COLOR[status],
        flexShrink: 0,
      }}
    />
  )
}
