const EM_DASH = '\u2014'

/** @type {import('eslint').Rule.RuleModule} */
export const noEmDash = {
  meta: {
    type: 'problem',
    docs: { description: 'Ban the em dash. Use an interpunct between facts or a period to end a sentence.' },
    messages: { emDash: 'Em dash found. Use an interpunct (·) between facts or a period to end a sentence.' },
    schema: [],
  },
  create(context) {
    return {
      Program() {
        const { text, lines } = context.sourceCode
        if (!text.includes(EM_DASH)) return
        lines.forEach((line, i) => {
          let col = line.indexOf(EM_DASH)
          while (col !== -1) {
            context.report({
              loc: { start: { line: i + 1, column: col }, end: { line: i + 1, column: col + 1 } },
              messageId: 'emDash',
            })
            col = line.indexOf(EM_DASH, col + 1)
          }
        })
      },
    }
  },
}
