import type { GameId } from './games'
import { speedArithmetic } from './speed-arithmetic'
import type { AnyGameModule } from './types'

/** Games that are playable. Games missing here show as "Coming soon". */
const GAME_MODULES: Partial<Record<GameId, AnyGameModule>> = {
  'speed-arithmetic': speedArithmetic,
}

export function getGameModule(id: string): AnyGameModule | undefined {
  return Object.hasOwn(GAME_MODULES, id) ? GAME_MODULES[id as GameId] : undefined
}
