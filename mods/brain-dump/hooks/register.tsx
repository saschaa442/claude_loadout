import type { EngineInterface, PromptSubmitInput, Register } from 'claude-code'

// The person's home folder, wherever the mod's folder lives (~/.claude/plugins, ~/.claude-mods or the vault).
const homeOf = (root: string) => /^\/(?:Users|home)\/[^/]+/.exec(root)?.[0] ?? root.split('/.claude')[0] ?? ''

// A long, loose prompt (a voice-note brain dump) gets an offer: shape it into
// the four-part brief first. Shaped text goes back in the prompt box for the
// person to read and edit; their next Enter sends it, since it holds AUFGABE.

const CMD = 'shape'
const MIN_WORDS = 150
const MODEL = 'sonnet'
const QUESTION = 'Das sieht nach einem Brain Dump aus. Erst in ein klares Briefing umformen?'
const SHAPE = 'Umformen'
const AS_IS = 'So senden'
const DROP_REASON = 'shaped into a brief'
const DONE_TOAST = 'Briefing steht im Eingabefeld. Prüfen, dann Enter.'
const HEADINGS = ['AUFGABE', 'ZWECK', 'LEITPLANKEN', 'FERTIG WENN'] as const
const MAX_QUESTIONS = 3
const SKIPPED = 'übersprungen, keine Antwort'
const UNKNOWN = 'offen: bitte nachfragen'
const STATUS_START = 'Forme deinen Brain Dump um...'
const STATUS_GAPS = 'Brain Dump: suche Lücken'
const STATUS_WRITE = 'Brain Dump: schreibe das Briefing'
// The dialog's chip holds 12 characters at most, so "Dump 1 von 2", not "Brain Dump · 1 von 2".
const askHeader = (i: number, n: number) => `Dump ${i} von ${n}`
const ENABLED = { plugin: 'brain-dump', key: 'enabled' } as const

const SYSTEM = `Du formst den gesprochenen Brain Dump einer Person in ein klares, kurzes Briefing für einen KI-Assistenten um.

Gib genau diese Form aus und sonst nichts, keine Einleitung, keine Code-Blöcke:

AUFGABE
<ein bis zwei Zeilen: was gemacht oder erstellt werden soll>

ZWECK
<für wen es ist und wofür es genutzt wird>

LEITPLANKEN
- <Regeln, Grenzen, was zu vermeiden ist, welche Quellen zu nutzen sind>

FERTIG WENN
- <woran man erkennt, dass es fertig und richtig ist>

Regeln:
- Antworte immer auf Deutsch, auch wenn der Dump teilweise englisch ist. Fachbegriffe, Namen und Zitate bleiben, wie sie sind.
- So kurz wie möglich: knappe Zeilen und Stichpunkte, keine ganzen Absätze, keine Wiederholungen.
- Behalte jeden Fakt, Namen, jede Zahl, jedes Datum, jeden Link, jede Datei und jedes Werkzeug aus dem Dump. Streiche nur Füllwörter und Wiederholungen.
- Füge keine neuen Fakten, Zahlen, Namen oder Anforderungen hinzu, die nicht im Dump stehen.
- Wo der Dump zu einem Teil nichts sagt, schreibe dort "${UNKNOWN}".
- Der Prompt kann <answers> enthalten: Rückfragen, die die Person beantwortet hat. Behandle jede Antwort als ihre eigenen Worte und setze sie in den passenden Teil. Ist eine Antwort übersprungen, schreibe diesen Punkt als "${UNKNOWN}" in den passenden Teil.
- Schreibe in der Stimme der Person (ich, wir, mein), als hätte sie das Briefing selbst geschrieben.
- Keine Gedankenstriche (— oder –).`

// Step A: a second, cheap read that only looks for real gaps or conflicts.
const GAPS_SYSTEM = `Du liest den gesprochenen Brain Dump einer Person, bevor er in ein Briefing für einen KI-Assistenten umgeformt wird.
Finde nur echte Lücken: zwei Anweisungen im Dump, die sich widersprechen, oder einen fehlenden Fakt, den man unbedingt braucht und der die Arbeit ändern würde (zum Beispiel für wen es ist, die Frist, das Format oder welche Quelle zu nutzen ist).

Gib nur JSON zurück, keinen Text, keine Code-Blöcke, genau in dieser Form:
{"questions":[{"q":"<kurze Frage mit Fragezeichen am Ende>","options":["<Option>","<Option>"]}]}

Regeln:
- 0 bis 3 Fragen. Ist der Dump klar, gib {"questions":[]} zurück. Weniger ist besser.
- Frag nie nach etwas, das der Dump schon beantwortet, und nie nach Stil oder Nebensächlichem.
- Bei einem Widerspruch nenne beide Seiten in der Frage und biete jede Seite als Option an.
- Jede Frage hat 2 oder 3 kurze Optionen (1 bis 5 Wörter), möglichst aus dem Dump übernommen. Keine Option "Sonstiges"; die Person kann selbst etwas eintippen.
- Kurzes, einfaches Deutsch. Keine Gedankenstriche (— oder –).`

export type Gap = { q: string; options: string[] }
export type QA = { q: string; a: string | null }

let home = ''

// The /mods switchboard turns this mod off in every chat with switches.json.
const NAME = 'brain-dump'
let off = false

async function readSwitch($: EngineInterface) {
  let now = false
  try {
    const path = `${homeOf($.plugin.root)}/.claude/mods/switches.json`
    if (await $.fs.exists(path)) {
      const json = JSON.parse(String(await $.fs.read(path))) as Record<string, unknown>
      now = json[NAME] === false
    }
  } catch {
    now = off
  }
  if (now === off) return
  off = now
  try {
    $.ui.invalidate('ui.render')
  } catch {
    // The next state change redraws anyway.
  }
}

const words = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

// The person's own prompt: typed at the box, or sent from their phone.
const fromPerson = (e: PromptSubmitInput) => e.origin.kind === 'composer' || e.origin.kind === 'bridge'

export const isBrainDump = (text: string) => {
  const t = text.trim()
  if (t.startsWith('/')) return false
  if (t.includes(HEADINGS[0])) return false
  return words(t) >= MIN_WORDS
}

// Holds the model to the house style even when it slips.
const stripFences = (raw: string) =>
  raw
    .trim()
    .replace(/^```[a-z]*\n?/i, '')
    .replace(/\n?```$/, '')
    .trim()

export const houseStyle = (raw: string) => raw.replace(/\s*[—–]\s*/g, ', ')

export const tidy = (raw: string) => {
  const t = houseStyle(stripFences(raw))
  const start = t.indexOf(HEADINGS[0])
  return start > 0 ? t.slice(start) : t
}

const hasAllHeadings = (text: string) => HEADINGS.every(h => text.includes(h))

async function log($: EngineInterface, line: string) {
  try {
    const dir = `${home}/.claude/mods-logs`
    const path = `${dir}/brain-dump.log`
    let old = ''
    if (await $.fs.exists(path).catch(() => false)) old = String(await $.fs.read(path))
    else await $.process.run(['mkdir', '-p', dir])
    await $.fs.write(path, `${old}${new Date().toISOString()} ${line}\n`)
  } catch {
    // Logging must never break a prompt.
  }
}

async function isOn($: EngineInterface) {
  const v = await $.store.get('enabled').catch(() => undefined)
  return v !== false
}

const failWhy = (r: { reason: string; error?: string; status?: number | null }) =>
  r.reason === 'api-error' ? `the model call failed (${r.error}${r.status ? ` ${r.status}` : ''})` : r.reason === 'aborted' ? 'the model call timed out' : 'the model gave no text'

// Reads step A's reply. Throws on anything that is not the JSON we asked for;
// the caller turns that into zero questions.
export const parseGaps = (raw: string): Gap[] => {
  const t = stripFences(raw)
  const a = t.indexOf('{')
  const b = t.lastIndexOf('}')
  if (a < 0 || b <= a) throw new Error('no JSON object in the reply')
  const json = JSON.parse(t.slice(a, b + 1)) as { questions?: unknown }
  if (!Array.isArray(json.questions)) throw new Error('no questions list in the reply')
  const out: Gap[] = []
  for (const item of json.questions) {
    if (out.length >= MAX_QUESTIONS) break
    const { q, options } = (item ?? {}) as { q?: unknown; options?: unknown }
    if (typeof q !== 'string' || !q.trim() || !Array.isArray(options)) continue
    const opts: string[] = []
    for (const o of options) {
      const label = typeof o === 'string' ? houseStyle(o.trim()) : ''
      if (!label || /^(other|sonstiges|andere)$/i.test(label) || opts.includes(label)) continue
      if (opts.length < 3) opts.push(label)
    }
    if (opts.length < 2) continue
    let question = houseStyle(q.trim())
    if (!question.endsWith('?')) question = `${question}?`
    out.push({ q: question, options: opts })
  }
  return out
}

// Step A. Never throws: a failed call or bad JSON means zero questions, logged.
async function findGaps($: EngineInterface, dump: string): Promise<Gap[]> {
  try {
    const r = await $.model.complete({
      model: MODEL,
      system: GAPS_SYSTEM,
      prompt: `Hier ist der Brain Dump. Gib das JSON zurück.\n\n<dump>\n${dump}\n</dump>`,
      maxTokens: 800,
      effort: 'low',
      timeoutMs: 45_000,
    })
    if (!r.isAnswered) {
      await log($, `gap check failed: ${failWhy(r)}; going on with 0 questions`)
      return []
    }
    try {
      return parseGaps(r.text)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      await log($, `gap check parse failed: ${why}; reply began ${JSON.stringify(r.text.slice(0, 80))}; going on with 0 questions`)
      return []
    }
  } catch (err) {
    await log($, `gap check threw: ${err instanceof Error ? err.message : String(err)}; going on with 0 questions`)
    return []
  }
}

// Asks each gap in the engine's dialog. A typed answer under "Other" comes back
// as the text itself. Dismissing one skips it.
async function askGaps($: EngineInterface, gaps: Gap[]): Promise<QA[]> {
  const out: QA[] = []
  for (const [i, g] of gaps.entries()) {
    $.ui.status(`Brain Dump: Frage ${i + 1} von ${gaps.length}`)
    let a: string | null = null
    try {
      const said = (await $.ui.ask(g.q, { options: g.options, header: askHeader(i + 1, gaps.length) })).trim()
      a = said || null
    } catch {
      a = null
    }
    out.push({ q: g.q, a })
  }
  return out
}

export const briefPrompt = (dump: string, qa: QA[]) => {
  let p = `Hier ist der Brain Dump. Forme ihn in das Briefing um.\n\n<dump>\n${dump}\n</dump>`
  if (qa.length) {
    const lines = qa.map(x => `Q: ${x.q}\nA: ${x.a ?? SKIPPED}`).join('\n\n')
    p += `\n\nIch habe der Person vorher diese Rückfragen gestellt. Nutze ihre Antworten im Briefing. Bei einer übersprungenen schreibe diesen Punkt als "${UNKNOWN}" in den passenden Teil.\n\n<answers>\n${lines}\n</answers>`
  }
  return p
}

// Step B: the brief itself, now with the answers.
async function shape($: EngineInterface, dump: string, qa: QA[]): Promise<string> {
  const r = await $.model.complete({
    model: MODEL,
    system: SYSTEM,
    prompt: briefPrompt(dump, qa),
    maxTokens: 2000,
    effort: 'low',
    timeoutMs: 60_000,
  })
  if (!r.isAnswered) throw new Error(failWhy(r))
  const brief = tidy(r.text)
  if (!hasAllHeadings(brief)) throw new Error('the brief came back without all four parts')
  return brief
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const result = await next(e)
    home = homeOf($.plugin.root)
    await $.command.register({ name: CMD, description: 'Brain-Dump-Umformen ein- oder ausschalten' })
    await $.state.set(ENABLED, await isOn($))
    await readSwitch($).catch(() => undefined)
    $.clock.every(3000, () => {
      void readSwitch($).catch(() => undefined)
    })
    return result
  })

  on('command.run', { command: CMD }, async $ => {
    if (off) return { text: 'Brain-Dump ist aus. Einschalten mit /mods.' }
    const now = !(await isOn($))
    await $.store.set('enabled', now)
    await $.state.set(ENABLED, now)
    const text = now ? 'Brain-Dump-Umformen ist an.' : 'Brain-Dump-Umformen ist aus.'
    $.ui.toast(text)
    return { text }
  })

  on('prompt.submit', async ($, e, next) => {
    if (off) return next(e)
    if (!fromPerson(e) || !isBrainDump(e.text)) return next(e)
    if (!(await isOn($))) return next(e)

    let answer = ''
    try {
      answer = await $.ui.ask(QUESTION, { options: [SHAPE, AS_IS], header: 'Brain Dump' })
    } catch {
      // Dismissed, or no one to ask: send it as typed.
      return next(e)
    }
    if (answer !== SHAPE) return next(e)

    const started = Date.now()
    const secs = () => `${((Date.now() - started) / 1000).toFixed(1)}s`
    let brief = ''
    let qa: QA[] = []
    try {
      $.ui.toast(STATUS_START)
      $.ui.status(STATUS_GAPS)
      const gaps = await findGaps($, e.text)
      qa = await askGaps($, gaps)
      $.ui.status(STATUS_WRITE)
      brief = await shape($, e.text, qa)
    } catch (err) {
      const why = err instanceof Error ? err.message : String(err)
      $.ui.status(undefined)
      $.ui.toast(`Umformen fehlgeschlagen (${why}). Unverändert gesendet.`)
      await log($, `shape failed after ${secs()} (${qa.length} questions): ${why}`)
      return next(e)
    }
    $.ui.status(undefined)
    const skipped = qa.filter(x => x.a === null).length
    await log($, `shaped in ${secs()}: ${qa.length} questions, ${qa.length - skipped} answered, ${skipped} skipped`)

    const filled = await $.prompt.fill({ text: brief, mode: 'replace' }).catch((err: unknown) => {
      void log($, `prompt.fill threw: ${err instanceof Error ? err.message : String(err)}`)
      return null
    })
    if (!filled?.isFilled) {
      const why = filled?.refusal ? `the prompt box refused it (${filled.refusal})` : 'the prompt box did not take it'
      $.ui.toast(`Umformen fehlgeschlagen (${why}). Unverändert gesendet.`)
      await log($, `prompt.fill refused: ${why}`)
      return next(e)
    }

    $.ui.toast(DONE_TOAST)
    return { drop: DROP_REASON }
  })
}
