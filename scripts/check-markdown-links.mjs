import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, normalize, relative, resolve } from 'node:path'
import process from 'node:process'

const root = process.cwd()
const ignored = new Set(['.git', '.next', 'node_modules'])

function markdownFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (ignored.has(entry.name)) return []
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return markdownFiles(path)
    return extname(entry.name).toLowerCase() === '.md' ? [path] : []
  })
}

function decodeTarget(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

const failures = []
let checked = 0

for (const file of markdownFiles(root)) {
  const markdown = readFileSync(file, 'utf8')
  const links = markdown.matchAll(/!?(?:\[[^\]]*\])\(([^)]+)\)/g)
  for (const match of links) {
    let target = match[1].trim()
    if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1)
    target = target.split(/\s+["']/)[0]
    if (!target || target.startsWith('#') || /^(?:https?:|mailto:|tel:)/i.test(target)) continue

    const pathPart = decodeTarget(target.split('#')[0].split('?')[0])
    if (!pathPart) continue
    const resolved = pathPart.startsWith('/')
      ? resolve(root, `.${normalize(pathPart)}`)
      : resolve(dirname(file), normalize(pathPart))
    checked += 1
    if (!resolved.startsWith(`${root}/`) && resolved !== root) {
      failures.push(`${relative(root, file)}: link escapes the repository: ${target}`)
      continue
    }
    if (!existsSync(resolved) || (!statSync(resolved).isFile() && !statSync(resolved).isDirectory())) {
      failures.push(`${relative(root, file)}: missing target: ${target}`)
    }
  }
}

if (failures.length) {
  console.error(failures.join('\n'))
  process.exitCode = 1
} else {
  console.log(`Validated ${checked} internal Markdown links.`)
}
