// Runs supabase/tests/*.test.sql against the linked hosted project without Docker.
// `supabase test db` needs Docker even with --linked, so instead each file is rewritten to
// collect pgTAP output into a temp table and raise it as an exception at the end. The
// exception aborts the transaction, so nothing a test inserts is ever kept.
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const TESTS_DIR = 'supabase/tests'
const TAP_FN = /^select (plan|is_empty|isnt_empty|throws_ok|lives_ok|results_eq|is|isnt|ok)\(/gm

function wrap(sql) {
  if (!sql.includes('select * from finish();'))
    throw new Error('test must end with select * from finish();')
  return sql
    .replace(/^begin;\n/m, '')
    .replace(/^rollback;\s*$/m, '')
    .replace(
      /^create extension if not exists pgtap[^\n]*\n/m,
      (line) =>
        line +
        'create temp table _tap (n serial, line text);\n' +
        'grant all on _tap to public;\ngrant all on sequence _tap_n_seq to public;\n',
    )
    .replace(TAP_FN, 'insert into _tap (line) select $1(')
    .replace(
      'select * from finish();',
      () =>
        'reset role;\ninsert into _tap (line) select * from finish();\n' +
        "do $$ begin raise exception E'TAP-BEGIN\\n%\\nTAP-END', " +
        "(select string_agg(line, E'\\n' order by n) from _tap); end $$;",
    )
}

const files = readdirSync(TESTS_DIR).filter((f) => f.endsWith('.test.sql'))
const dir = mkdtempSync(join(tmpdir(), 'brian-db-test-'))
let failed = false

for (const file of files) {
  const wrapped = join(dir, file)
  writeFileSync(wrapped, wrap(readFileSync(join(TESTS_DIR, file), 'utf8')))
  let out = ''
  try {
    out = execFileSync('supabase', ['db', 'query', '--linked', '-f', wrapped], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    })
  } catch (e) {
    out = `${e.stdout ?? ''}${e.stderr ?? ''}`
  }
  const tap = out.replace(/\\n/g, '\n').match(/TAP-BEGIN\n([\s\S]*?)\nTAP-END/)
  console.log(`# ${file}`)
  if (!tap) {
    console.log(out.trim())
    failed = true
    continue
  }
  console.log(tap[1])
  if (/^not ok/m.test(tap[1]) || /Looks like/m.test(tap[1])) failed = true
}

process.exit(failed ? 1 : 0)
