# Form

A small card that collects a few values and does one thing with them: a header, two to four labeled fields, and an actions row on the tinted ground.

- The composer picks Form when the next step needs input the screen cannot guess: change the scope and ask again, compare two windows, pick a branch. Never more than four fields; anything larger is not a composed screen.
- Schema: `title`, optional `meta` (the current scope), `fields` (an ordered list of TextInput, Select and FilterChips specs), `submit` (the primary's label, a verb phrase such as "Ask again"), optional `secondary` ("Reset" or "Cancel") and `effect` (a short line saying what submit does, such as "replaces this screen"). The model chooses the fields and the words. The system lays them out, validates them and writes every error.
- Card: the shared card frame (`radius-lg`, `line-soft` border, `card` shadow) and the shared header, title in `card-title` and the scope in `meta` on the right. A card has no inner card: fields sit straight on its surface.
- Body: its padding and the gap between field groups are both the density's side padding (`space-4`, `space-5`, `space-6`). One value sets the whole rhythm, and every field edge sits on the card's content edge, in line with every card above and below.
- Field group: label, field, message slot. The label sits `space-1` above the field at compact and `space-2` otherwise; the slot sits the same distance below, its sentences in sans 12.5px (muted helper, crit error). FilterChips take a label like any other field.
- Focus: the 2px `focus` ring outside each control's border, never accent. On a failed submit the first invalid field gets focus and shows both its crit border and the ring.
- Actions: `surface-tint` ground (the system's action area) under a `line-soft` rule, padded `card-y` by the side padding. Primary first, left aligned on the content edge, the secondary `space-2` after it. Buttons are the field height, 36, 40 or 44px, with `space-4` or `space-5` side padding, so no button looks shorter than the field above it. The effect sits in `meta` on the right and truncates before it wraps.
- Default is filled: a composed form arrives prefilled with the screen's current scope, so default and filled are one picture.
- Error: validation runs on submit, then on blur. Focus moves to the first invalid field, and only fields that are wrong turn crit. A field that depends on a wrong one renders disabled with a helper saying what it waits for ("Milestones load once the repo checks out"), never with an error of its own.
- Submitting: the fields go read only and the primary keeps its label with `aria-busy`; the screen rewrite is the confirmation. If the request fails, the effect line becomes the unreachable line (unavailable mark, what failed in ink, the cause as a mono fact, Try again in `accent-text`) and the fields unlock. Never crit.
- Skeleton, empty and warming do not apply: a form has nothing of its own to load. A Select whose options are still on their way renders disabled and says so.
- Motion: the card rises (550ms) like every card, the field groups slide in 70ms apart top to bottom, and the actions row arrives with the card. No bloom: bloom belongs to flagged cards and the ActionCard. On success the form exits with the rewrite, region by region. Nothing bounces.
- Accessibility: a real `<form>` named by its title, Enter submits from any text field, tab order follows the page order, one primary per form, and every message is tied to its field through `aria-describedby`.

The full sheet lives in the [Generative UI components](https://claude.ai/artifact/Y1VwMbCVASqupxjZ8k3mLK) canvas, page Inputs-States.
