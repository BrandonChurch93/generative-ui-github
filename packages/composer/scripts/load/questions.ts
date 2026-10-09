import { TEMPLATE_IDS, TEMPLATE_NEEDS } from '../../src/templates/needs'

/** The twelve golden questions, as the templates name them. */
export const GOLDEN_QUESTIONS = TEMPLATE_IDS.filter(id => TEMPLATE_NEEDS[id].kind === 'golden').map(id => TEMPLATE_NEEDS[id].question)
