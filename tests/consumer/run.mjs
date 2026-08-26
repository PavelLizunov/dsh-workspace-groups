import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, execSync } from 'node:child_process'

const rootDir = path.resolve(import.meta.dirname, '../..')

function run(command, cwd, options = {}) {
  return execSync(command, { cwd, stdio: 'inherit', ...options })
}

console.log('[consumer-test] 1. Verifying source consumer TypeScript compilation...')
run('pnpm exec tsc -p tests/consumer/tsconfig.json --noEmit', rootDir)

console.log('[consumer-test] 2. Verifying declaration import paths and targets...')
function checkDtsDir(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name)
    if (entry.isDirectory()) checkDtsDir(fullPath)
    else if (entry.isFile() && fullPath.endsWith('.d.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8')
      if (/from\s+['"]\..*?\.ts['"]/g.test(content) || /import\(['"]\..*?\.ts['"]\)/g.test(content)) {
        throw new Error(`invalid .ts declaration import: ${path.relative(rootDir, fullPath)}`)
      }
      for (const match of content.matchAll(/(?:from\s+|import\()(['"])(\..*?\.js)\1/g)) {
        const jsPath = path.resolve(path.dirname(fullPath), match[2])
        const dtsPath = jsPath.replace(/\.js$/, '.d.ts')
        if (!fs.existsSync(dtsPath)) throw new Error(`missing declaration target for ${match[2]} from ${path.relative(rootDir, fullPath)}`)
      }
    }
  }
}
checkDtsDir(path.join(rootDir, 'lib/types'))

console.log('[consumer-test] 3. Verifying deterministic client bundle...')
const clientBundle = fs.readFileSync(path.join(rootDir, 'lib/client.js'), 'utf8')
if (clientBundle.includes('/var/lib/dsh') || clientBundle.includes('/home/') || clientBundle.includes('/Users/')) {
  throw new Error('machine-specific absolute path in lib/client.js')
}

console.log('[consumer-test] 4. Packing and installing the real tarball in an isolated consumer...')
const packJson = JSON.parse(execSync('pnpm pack --json', { cwd: rootDir, encoding: 'utf8' }))
const pack = Array.isArray(packJson) ? packJson[0] : packJson
const tarball = path.resolve(rootDir, pack.filename)
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wg-consumer-'))
try {
  const manifest = {
    private: true,
    type: 'module',
    dependencies: {
      'dsh-workspace-groups': `file:${tarball}`,
    },
  }
  fs.writeFileSync(path.join(tempDir, 'package.json'), `${JSON.stringify(manifest, null, 2)}\n`)
  execFileSync('pnpm', ['install', '--ignore-scripts', '--no-frozen-lockfile'], { cwd: tempDir, stdio: 'inherit' })
  const hostModule = await import(path.join(tempDir, 'node_modules/dsh-workspace-groups/lib/index.js'))
  if (hostModule.name !== 'dsh-workspace-groups' || !Array.isArray(hostModule.inject) || typeof hostModule.apply !== 'function') {
    throw new Error('installed host export contract invalid')
  }
  const packageJson = JSON.parse(fs.readFileSync(path.join(tempDir, 'node_modules/dsh-workspace-groups/package.json'), 'utf8'))
  for (const required of ['README.md', 'README_ZH.md', 'workspace-groups.example.yaml', 'cordis.patch.yml', 'lib/client.js']) {
    if (!fs.existsSync(path.join(tempDir, 'node_modules/dsh-workspace-groups', required))) throw new Error(`installed package missing ${required}`)
  }
  if (packageJson.exports?.['./client']?.default !== './lib/client.js') throw new Error('client export is missing')
} finally {
  fs.rmSync(tempDir, { recursive: true, force: true })
  fs.rmSync(tarball, { force: true })
}

console.log('[consumer-test] ALL CONSUMER VERIFICATION CHECKS PASSED!')
