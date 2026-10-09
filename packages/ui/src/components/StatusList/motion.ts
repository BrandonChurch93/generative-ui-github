import { captureRows, rowsEnter, rowsExit, rowsUpdate, type PieceMotion } from '../../motion'
import type { StatusListProps } from './schema'

export const statusListMotion: PieceMotion<StatusListProps> = {
  capture: captureRows,
  enter: (root, _props, options) => rowsEnter(root, options),
  exit: (root, _props, options) => rowsExit(root, options),
  update: (root, prev, _next, options) => rowsUpdate(root, prev.items.map(i => i.id), options),
  morph: (root, prev, _next, options) => rowsUpdate(root, prev.items.map(i => i.id), options),
}
