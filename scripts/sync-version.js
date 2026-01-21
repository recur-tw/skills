import { readFileSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

const pkgPath = join(__dirname, '..', 'package.json')
const mpPath = join(__dirname, '..', '.claude-plugin', 'marketplace.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))
const mp = JSON.parse(readFileSync(mpPath, 'utf8'))

mp.metadata.version = pkg.version
writeFileSync(mpPath, JSON.stringify(mp, null, 2) + '\n')

console.log(`✓ Synced marketplace.json version to ${pkg.version}`)
