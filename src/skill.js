import { existsSync, lstatSync, mkdirSync, readFileSync, symlinkSync, unlinkSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const SKILL_DIR = fileURLToPath(new URL('../skills/feedbai/', import.meta.url))

export const readSkill = () => readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8')

/** Agents with a skills directory: [agent home, skills dir]. */
const AGENTS = {
  claude: ['.claude', '.claude/skills'],
  codex: ['.codex', '.codex/skills'],
  pi: ['.pi', '.pi/agent/skills'],
}

/** Symlink the skill into every installed agent's skills dir. */
export const installSkill = (home = homedir()) =>
  Object.entries(AGENTS)
    .filter(([, [agentHome]]) => existsSync(join(home, agentHome)))
    .map(([agent, [, skills]]) => {
      const target = join(home, skills, 'feedbai')
      mkdirSync(dirname(target), { recursive: true })
      if (existsSync(target) || lstatSync(target, { throwIfNoEntry: false })?.isSymbolicLink()) {
        if (!lstatSync(target).isSymbolicLink()) return { agent, target, skipped: true }
        unlinkSync(target)
      }
      symlinkSync(SKILL_DIR, target)
      return { agent, target }
    })
