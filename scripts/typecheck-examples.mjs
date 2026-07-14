#!/usr/bin/env node
/**
 * Typecheck every TypeScript/TSX code example in each skill's SKILL.md
 * against the real `recur-tw` SDK (and next/react/express types).
 *
 * This is the drift guard: when the SDK's API changes, this script fails and
 * points at the exact skill + line whose example no longer compiles.
 *
 * Rules:
 * - Fenced blocks tagged `ts`, `tsx`, or `typescript` are checked.
 * - Add `no-check` to the info string to skip a block that is intentionally
 *   a fragment (e.g. ```tsx no-check).
 * - Each block must be self-contained (include its imports). Blocks without
 *   imports/exports get `export {}` appended so they compile as modules.
 *
 * Usage: node scripts/typecheck-examples.mjs [skill-name]
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { execSync } from 'node:child_process'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKILLS_DIR = join(ROOT, 'skills')
const BUILD_DIR = join(ROOT, '.examples-build')
const CHECKED_LANGS = new Set(['ts', 'tsx', 'typescript'])

const onlySkill = process.argv[2]

// --- Extract fenced code blocks -------------------------------------------

/** @returns {{lang: string, info: string, code: string, line: number}[]} */
function extractBlocks(markdown) {
  const blocks = []
  const lines = markdown.split('\n')
  let current = null
  for (let i = 0; i < lines.length; i++) {
    const fence = lines[i].match(/^```(\S*)\s*(.*)$/)
    if (fence && !current) {
      current = { lang: fence[1], info: fence[2], code: [], line: i + 1 }
    } else if (lines[i].startsWith('```') && current) {
      blocks.push({ ...current, code: current.code.join('\n') })
      current = null
    } else if (current) {
      current.code.push(lines[i])
    }
  }
  return blocks
}

// --- Collect examples -------------------------------------------------------

rmSync(BUILD_DIR, { recursive: true, force: true })
mkdirSync(BUILD_DIR, { recursive: true })

const manifest = [] // { file, skill, mdLine }
let skipped = 0

const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name)
  .filter((name) => !onlySkill || name === onlySkill)

for (const skill of skillDirs) {
  const mdPath = join(SKILLS_DIR, skill, 'SKILL.md')
  if (!existsSync(mdPath)) continue
  const blocks = extractBlocks(readFileSync(mdPath, 'utf8'))

  let n = 0
  for (const block of blocks) {
    if (!CHECKED_LANGS.has(block.lang)) continue
    if (/\bno-check\b/.test(block.info)) {
      skipped++
      continue
    }
    n++
    let code = block.code
    if (!/^\s*(import|export)\b/m.test(code)) code += '\nexport {}\n'
    const file = join(BUILD_DIR, `${skill}.${String(n).padStart(2, '0')}.tsx`)
    writeFileSync(file, code)
    manifest.push({ file, skill, mdLine: block.line })
  }
}

if (manifest.length === 0) {
  console.log('No checkable examples found.')
  process.exit(0)
}

// --- Typecheck --------------------------------------------------------------

const tsconfig = {
  compilerOptions: {
    target: 'ES2022',
    lib: ['dom', 'dom.iterable', 'esnext'],
    module: 'esnext',
    moduleResolution: 'bundler',
    jsx: 'react-jsx',
    strict: true,
    noUnusedLocals: false,
    noUnusedParameters: false,
    noEmit: true,
    skipLibCheck: true,
    esModuleInterop: true,
    types: ['node'],
    paths: { '@/*': ['./stubs/*'] },
  },
  include: ['*.tsx', 'stubs/**/*.ts'],
}
writeFileSync(join(BUILD_DIR, 'tsconfig.json'), JSON.stringify(tsconfig, null, 2))

// Stubs for app-code imports that examples reference but that live in the
// user's own project (auth, etc.). Keep signatures realistic.
mkdirSync(join(BUILD_DIR, 'stubs', 'lib'), { recursive: true })
writeFileSync(
  join(BUILD_DIR, 'stubs', 'lib', 'auth.ts'),
  `export async function auth(): Promise<{ user?: { email?: string | null } } | null> { return null }\n`
)
mkdirSync(join(BUILD_DIR, 'stubs', 'components'), { recursive: true })
writeFileSync(
  join(BUILD_DIR, 'stubs', 'components', 'portal-button.ts'),
  `export declare function PortalButton(): React.ReactNode\nimport type React from 'react'\n`
)

let output = ''
let failed = false
try {
  execSync(`pnpm exec tsc -p ${BUILD_DIR}`, { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' })
} catch (err) {
  failed = true
  output = String(err.stdout ?? '') + String(err.stderr ?? '')
}

// --- Report -----------------------------------------------------------------

console.log(`Checked ${manifest.length} example blocks (${skipped} skipped via no-check)\n`)

if (!failed) {
  console.log('✅ All examples typecheck against the installed recur-tw SDK.')
  const version = JSON.parse(
    readFileSync(join(ROOT, 'node_modules', 'recur-tw', 'package.json'), 'utf8')
  ).version
  console.log(`   recur-tw@${version}`)
  process.exit(0)
}

// Map errors back to SKILL.md locations.
const errors = output.split('\n').filter((l) => l.includes('error TS'))
const bySkill = new Map()
for (const line of errors) {
  const m = line.match(/\.examples-build\/(.+?)\.(\d+)\.tsx\((\d+),/)
  const key = m ? `${m[1]}/SKILL.md (example #${Number(m[2])})` : 'general'
  if (!bySkill.has(key)) bySkill.set(key, [])
  bySkill.get(key).push(line.trim())
}

console.log('❌ Example typecheck failures:\n')
for (const [where, errs] of bySkill) {
  console.log(`  ${where}`)
  for (const e of errs.slice(0, 8)) console.log(`    ${e}`)
  if (errs.length > 8) console.log(`    ... and ${errs.length - 8} more`)
  console.log()
}
console.log(`Total: ${errors.length} errors. Generated sources kept in .examples-build/ for inspection.`)
process.exit(1)
