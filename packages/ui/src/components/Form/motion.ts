import { gsap } from 'gsap'
import { one, slide, within, type PieceMotion } from '../../motion'
import { countChips } from '../FilterChips/motion'
import { fieldName, type FormProps } from './schema'

const groups = (root: HTMLElement) => within(root, '[data-field-group]')

function changes(root: HTMLElement, prev: FormProps, next: FormProps, options = {}) {
  const tl = gsap.timeline()
  const before = new Map(prev.fields.map((f, i) => [fieldName(f, i), f]))
  next.fields.forEach((field, i) => {
    const name = fieldName(field, i)
    const node = within(root, '[data-field]').find(n => n.dataset.field === name)
    if (!node) return
    const old = before.get(name)
    if (!old) {
      const group = one(node, '[data-field-group]')
      if (group) tl.add(slide(group, options), 0)
    } else if (field.component === 'FilterChips' && old.component === 'FilterChips') {
      tl.add(countChips(node, old.counts, field.counts, options), 0)
    }
  })
  return tl
}

export const formMotion: PieceMotion<FormProps> = {
  // The card rises with the renderer's wrapper and the actions row arrives with it; the field groups slide in
  // 70ms apart top to bottom. No bloom: bloom belongs to flagged cards and the ActionCard.
  enter: (root, _props, options = {}) => slide(groups(root), options),
  exit: (root, _props, options = {}) => slide(groups(root), { ...options, direction: 'out' }),
  update: (root, prev, next, options = {}) => changes(root, prev, next, options),
  morph: (root, prev, next, options = {}) => changes(root, prev, next, options),
}
