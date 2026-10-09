import { CodeBlock } from '@genui-github/ui/schemas'
import { bound, empty, unavailable, type Binder, type DataContext } from './types'

type CodeBlockModel = CodeBlock.CodeBlockModelProps
type Bound = CodeBlock.CodeBlockProps

const COMPONENT = 'CodeBlock'
const nameOf = (path: string) => path.split('/').pop() || path

/** The README is the only file whose text the context holds; GitHub names it in any case, so match it that way. */
function readmeFor(ctx: DataContext, repo: string, path: string) {
  const readme = ctx.shapes.readme
  if (!readme || repo.toLowerCase() !== `${ctx.repo.owner}/${ctx.repo.name}`.toLowerCase()) return undefined
  const asked = path.replace(/^\.?\//, '').toLowerCase()
  return asked === readme.path.toLowerCase() || (asked === 'readme.md' && !readme.path.includes('/')) ? readme : undefined
}

/** A snippet of a file the context holds. Only the README is fetched, so any other path says it is not in this answer's data. */
export const bindCodeBlock: Binder<CodeBlockModel> = (ctx, props, extras = {}) => {
  const readme = readmeFor(ctx, props.repo, props.path)
  if (!readme) {
    return unavailable(COMPONENT, props, { ...props, text: '' } satisfies Bound, { failed: CodeBlock.CODE_WORDS.failed(nameOf(props.path)), cause: "This file is not in this answer's data" }, extras)
  }
  const all = readme.text.replace(/\r\n/g, '\n').replace(/\n$/, '')
  const lines = all === '' ? [] : all.split('\n')
  const [from, to] = props.lines ?? [1, lines.length]
  const text = lines.slice(from - 1, to).join('\n')
  const out: Bound = { ...props, path: readme.path, text, start: from, fileLines: lines.length, ref: ctx.repo.sha }
  // A range that runs past the end shows, and is named as, the lines the file has.
  if (props.lines && to > lines.length && from <= lines.length) out.lines = [from, lines.length]
  if (!lines.length || from > lines.length) return empty(COMPONENT, props, { ...out, text: '' }, extras)
  return bound(COMPONENT, props, out, extras)
}
