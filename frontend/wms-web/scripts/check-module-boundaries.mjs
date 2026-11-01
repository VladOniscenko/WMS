import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'

const root = new URL('../src/modules/', import.meta.url)
const modules = (await readdir(root, { withFileTypes: true })).filter((entry) => entry.isDirectory()).map((entry) => entry.name)
const violations = []

for (const moduleName of modules) {
  const files = await readdir(new URL(`${moduleName}/`, root), { withFileTypes: true })
  for (const file of files.filter((entry) => entry.isFile() && /\.(ts|tsx)$/.test(entry.name))) {
    const source = await readFile(join(root.pathname, moduleName, file.name), 'utf8')
    for (const other of modules.filter((candidate) => candidate !== moduleName)) {
      if (source.includes(`@modules/${other}`) || source.includes(`/modules/${other}`)) violations.push(`${moduleName}/${file.name} imports ${other}`)
    }
  }
}

if (violations.length) {
  console.error(violations.join('\n'))
  process.exit(1)
}
