import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SKILLS_DIR = join(__dirname, '..', 'skills')

export interface SkillMetadata {
  name: string
  description: string
}

export interface Skill extends SkillMetadata {
  slug: string
  content: string
  path: string
}

/**
 * Parse SKILL.md frontmatter
 */
function parseFrontmatter(content: string): { data: Record<string, string>; content: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!match) {
    return { data: {}, content }
  }

  const data: Record<string, string> = {}
  const lines = match[1].split('\n')
  for (const line of lines) {
    const colonIndex = line.indexOf(':')
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim()
      const value = line.slice(colonIndex + 1).trim()
      data[key] = value
    }
  }

  return { data, content: match[2] }
}

/**
 * Get all available skills
 */
export function getAllSkills(): Skill[] {
  if (!existsSync(SKILLS_DIR)) {
    return []
  }

  const skillDirs = readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .map(dirent => dirent.name)

  const skills: Skill[] = []

  for (const dir of skillDirs) {
    const skillPath = join(SKILLS_DIR, dir, 'SKILL.md')
    if (!existsSync(skillPath)) continue

    const rawContent = readFileSync(skillPath, 'utf-8')
    const { data, content } = parseFrontmatter(rawContent)

    skills.push({
      slug: dir,
      name: data.name || dir,
      description: data.description || '',
      content,
      path: skillPath,
    })
  }

  return skills
}

/**
 * Get a single skill by slug
 */
export function getSkill(slug: string): Skill | null {
  const skillPath = join(SKILLS_DIR, slug, 'SKILL.md')
  if (!existsSync(skillPath)) return null

  const rawContent = readFileSync(skillPath, 'utf-8')
  const { data, content } = parseFrontmatter(rawContent)

  return {
    slug,
    name: data.name || slug,
    description: data.description || '',
    content,
    path: skillPath,
  }
}

/**
 * Get skill names only (for listing)
 */
export function getSkillNames(): string[] {
  if (!existsSync(SKILLS_DIR)) {
    return []
  }

  return readdirSync(SKILLS_DIR, { withFileTypes: true })
    .filter(dirent => dirent.isDirectory())
    .filter(dirent => existsSync(join(SKILLS_DIR, dirent.name, 'SKILL.md')))
    .map(dirent => dirent.name)
}

/**
 * Get the path to skills directory
 */
export function getSkillsDir(): string {
  return SKILLS_DIR
}
