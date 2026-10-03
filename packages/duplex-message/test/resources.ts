import { afterEach } from 'vitest'

type Resource = { destroy(): void } | { terminate(): void } | { remove(): void }
const resources = new Set<Resource>()

export function track<T extends Resource>(resource: T): T {
  resources.add(resource)
  return resource
}

afterEach(() => {
  for (const resource of resources) {
    if ('destroy' in resource) resource.destroy()
    else if ('terminate' in resource) resource.terminate()
    else resource.remove()
  }
  resources.clear()
})
