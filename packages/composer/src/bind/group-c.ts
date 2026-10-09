import { bindCodeBlock } from './CodeBlock'
import { bindDiffView } from './DiffView'
import { bindFileTree } from './FileTree'
import { bindFilterChips } from './FilterChips'
import { bindForm } from './Form'
import { bindSteps } from './Steps'
import { bindTimeline } from './Timeline'

export const BINDERS_C = {
  Timeline: bindTimeline,
  Steps: bindSteps,
  FileTree: bindFileTree,
  DiffView: bindDiffView,
  CodeBlock: bindCodeBlock,
  FilterChips: bindFilterChips,
  Form: bindForm,
} as const
