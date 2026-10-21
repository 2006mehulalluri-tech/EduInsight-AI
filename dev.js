import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = path.dirname(fileURLToPath(import.meta.url))

console.log('----------------------------------------------------')
console.log(' Starting College Review Quality Analysis System')
console.log(' Backend:  http://localhost:5000')
console.log(' Frontend: http://localhost:5173')
console.log('----------------------------------------------------\n')

const serverProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'server'),
  stdio: 'inherit',
  shell: true,
})

const clientProcess = spawn('npm', ['run', 'dev'], {
  cwd: path.join(rootDir, 'client'),
  stdio: 'inherit',
  shell: true,
})

function cleanup() {
  console.log('\nShutting down dev servers...')
  try {
    if (serverProcess.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(serverProcess.pid), '/f', '/t'])
      } else {
        serverProcess.kill('SIGTERM')
      }
    }
  } catch {}

  try {
    if (clientProcess.pid) {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(clientProcess.pid), '/f', '/t'])
      } else {
        clientProcess.kill('SIGTERM')
      }
    }
  } catch {}

  process.exit(0)
}

process.on('SIGINT', cleanup)
process.on('SIGTERM', cleanup)

