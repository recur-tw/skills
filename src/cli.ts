import { program } from 'commander'
import pc from 'picocolors'
import { existsSync, mkdirSync, cpSync, readdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { getAllSkills, getSkill, getSkillsDir } from './index.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_SOURCE = join(__dirname, '..', 'skills')

program
  .name('recur-skills')
  .description('Claude Code skills for Recur payment integration')
  .version('0.0.1')

program
  .command('list')
  .description('List all available skills')
  .action(() => {
    const skills = getAllSkills()

    if (skills.length === 0) {
      console.log(pc.yellow('No skills found.'))
      return
    }

    console.log(pc.bold('\n📦 Available Recur Skills\n'))

    for (const skill of skills) {
      console.log(pc.cyan(`  ${skill.name}`))
      console.log(pc.dim(`     ${skill.description}\n`))
    }

    console.log(pc.dim(`Total: ${skills.length} skills\n`))
  })

program
  .command('info <skill>')
  .description('Show detailed information about a skill')
  .action((skillName: string) => {
    const skill = getSkill(skillName)

    if (!skill) {
      console.log(pc.red(`Skill "${skillName}" not found.`))
      console.log(pc.dim('\nRun `recur-skills list` to see available skills.'))
      process.exit(1)
    }

    console.log(pc.bold(`\n📦 ${skill.name}\n`))
    console.log(pc.dim('Description:'))
    console.log(`  ${skill.description}\n`)
    console.log(pc.dim('Path:'))
    console.log(`  ${skill.path}\n`)
  })

program
  .command('install [skills...]')
  .description('Install skills to your Claude Code skills directory')
  .option('-g, --global', 'Install to global ~/.claude/skills/', false)
  .option('-p, --project', 'Install to project .claude/skills/', false)
  .option('-a, --all', 'Install all skills', false)
  .action((skillNames: string[], options: { global: boolean; project: boolean; all: boolean }) => {
    // Determine target directory
    let targetDir: string
    if (options.global) {
      targetDir = join(process.env.HOME || '~', '.claude', 'skills')
    } else if (options.project) {
      targetDir = join(process.cwd(), '.claude', 'skills')
    } else {
      // Default to global
      targetDir = join(process.env.HOME || '~', '.claude', 'skills')
    }

    // Determine which skills to install
    let toInstall: string[]
    if (options.all) {
      toInstall = readdirSync(SKILLS_SOURCE, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name)
    } else if (skillNames.length === 0) {
      console.log(pc.yellow('Please specify skills to install or use --all'))
      console.log(pc.dim('\nExamples:'))
      console.log(pc.dim('  recur-skills install recur-quickstart'))
      console.log(pc.dim('  recur-skills install recur-checkout recur-webhooks'))
      console.log(pc.dim('  recur-skills install --all'))
      process.exit(1)
    } else {
      toInstall = skillNames
    }

    // Create target directory
    if (!existsSync(targetDir)) {
      mkdirSync(targetDir, { recursive: true })
    }

    console.log(pc.bold(`\n📦 Installing skills to ${targetDir}\n`))

    let installed = 0
    for (const skillName of toInstall) {
      const sourcePath = join(SKILLS_SOURCE, skillName)
      const destPath = join(targetDir, skillName)

      if (!existsSync(sourcePath)) {
        console.log(pc.red(`  ✗ ${skillName} - not found`))
        continue
      }

      try {
        cpSync(sourcePath, destPath, { recursive: true })
        console.log(pc.green(`  ✓ ${skillName}`))
        installed++
      } catch (error) {
        console.log(pc.red(`  ✗ ${skillName} - ${error}`))
      }
    }

    console.log(pc.dim(`\nInstalled ${installed}/${toInstall.length} skills\n`))

    if (installed > 0) {
      console.log(pc.cyan('Skills are now available in Claude Code!'))
      console.log(pc.dim('Claude will automatically use them when relevant,'))
      console.log(pc.dim('or you can invoke them directly with /skill-name\n'))
    }
  })

program
  .command('path')
  .description('Show the path to the skills directory')
  .action(() => {
    console.log(getSkillsDir())
  })

program.parse()
