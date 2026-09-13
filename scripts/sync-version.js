import { readFileSync, writeFileSync, readdirSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const skillsDir = join(__dirname, '..', 'skills')

const pkgPath = join(__dirname, '..', 'package.json')
const mpPath = join(__dirname, '..', '.claude-plugin', 'marketplace.json')
const pluginPath = join(__dirname, '..', '.claude-plugin', 'plugin.json')

const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'))

// Sync marketplace.json
const mp = JSON.parse(readFileSync(mpPath, 'utf8'))
mp.version = pkg.version
mp.metadata.version = pkg.version
if (mp.plugins?.[0]) mp.plugins[0].version = pkg.version
writeFileSync(mpPath, JSON.stringify(mp, null, 2) + '\n')
console.log(`✓ Synced marketplace.json to ${pkg.version}`)

const plugin = JSON.parse(readFileSync(pluginPath, 'utf8'))
plugin.version = pkg.version
writeFileSync(pluginPath, JSON.stringify(plugin, null, 2) + '\n')
console.log(`✓ Synced plugin.json to ${pkg.version}`)

// Sync all SKILL.md files
const skillFolders = readdirSync(skillsDir, { withFileTypes: true })
  .filter(d => d.isDirectory())
  .map(d => d.name)

for (const folder of skillFolders) {
  const skillPath = join(skillsDir, folder, 'SKILL.md')
  try {
    let content = readFileSync(skillPath, 'utf8')
    // Update version in frontmatter metadata
    content = content.replace(
      /^(metadata:\s*\n\s*author:\s*\S+\s*\n\s*version:\s*)"[^"]*"/m,
      `$1"${pkg.version}"`
    )
    writeFileSync(skillPath, content)
    console.log(`✓ Synced ${folder}/SKILL.md to ${pkg.version}`)
  } catch {
    // Skip if SKILL.md doesn't exist
  }
}

console.log(`\n✅ All versions synced to ${pkg.version}`)
