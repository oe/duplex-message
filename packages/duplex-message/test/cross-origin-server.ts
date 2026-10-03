import { createServer } from 'vite'
import type { TestProject } from 'vitest/node'

declare module 'vitest' {
  export interface ProvidedContext { frameOrigin: string }
}

export default async function setup(project: TestProject) {
  const server = await createServer({
    configFile: false,
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const address = server.httpServer!.address()
  if (!address || typeof address === 'string') throw new Error('fixture server did not bind a port')
  project.provide('frameOrigin', `http://127.0.0.1:${address.port}`)
  return () => server.close()
}
