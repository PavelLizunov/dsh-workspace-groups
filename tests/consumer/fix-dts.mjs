import fs from 'node:fs'
import path from 'node:path'

function processDir(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) {
      processDir(fullPath)
    } else if (entry.isFile() && fullPath.endsWith('.d.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      const updated = content
        .replace(/from\s+(['"])(\..*?)\.ts\1/g, 'from $1$2.js$1')
        .replace(/import\((['"])(\..*?)\.ts\1\)/g, 'import($1$2.js$1)')
      if (updated !== content) {
        fs.writeFileSync(fullPath, updated, 'utf8')
      }
    }
  }
}

const typesDir = path.resolve(process.cwd(), 'lib/types')
if (fs.existsSync(typesDir)) {
  processDir(typesDir)
}
