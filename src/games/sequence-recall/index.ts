import type { RunGameModule } from '@/games/types'
import { SequenceRecallView } from './SequenceRecallView'

export const sequenceRecall: RunGameModule = {
  kind: 'run',
  id: 'sequence-recall',
  readyHint: 'Watch the tiles light up, then tap them in the same order. Two mistakes ends the run.',
  RunView: SequenceRecallView,
}
