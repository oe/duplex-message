import { PostMessageHub } from '../../../src/post-message'
import { READY_METHOD } from '../../../src/readiness'

const parentOrigin = new URL(location.href).searchParams.get('parentOrigin')!
const hub = new PostMessageHub({ allowedOrigins: [parentOrigin], targetOrigin: parentOrigin })
hub.on(parent, 'echo', (value: string) => value)
// Represents asynchronous application initialization after the document loads.
setTimeout(() => hub.on(parent, READY_METHOD, () => true), 200)
