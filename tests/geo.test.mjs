import assert from 'node:assert/strict'
import test from 'node:test'
import { registerHooks } from 'node:module'

const harness = { native: false, locate: null }
globalThis.geoHarness = harness
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/src/lib/geo.ts')) {
      if (specifier === '@capacitor/core') {
        return { url: 'data:text/javascript,export const Capacitor = { isNativePlatform: () => globalThis.geoHarness.native }', shortCircuit: true }
      }
      if (specifier === '@capacitor/geolocation') {
        return { url: 'data:text/javascript,export const Geolocation = { getCurrentPosition: (options) => globalThis.geoHarness.locate(options) }', shortCircuit: true }
      }
      if (specifier.startsWith('.')) return nextResolve(`${specifier}.ts`, context)
    }
    return nextResolve(specifier, context)
  },
})

const { getCurrentPosition, nearestServiceRegion } = await import('../src/lib/geo.ts')
const position = { coords: { latitude: 36.35, longitude: 127.8 } }
const options = { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }

test('native location uses the plugin with approximate permission and propagates rejection', async () => {
  harness.native = true
  harness.locate = async (received) => {
    assert.deepEqual(received, options)
    return position
  }
  assert.deepEqual(await getCurrentPosition(), { lat: 36.35, lng: 127.8 })
  for (const code of ['OS-PLUG-GLOC-0003', 'OS-PLUG-GLOC-0007', 'OS-PLUG-GLOC-0010']) {
    const error = Object.assign(new Error('Location unavailable'), { code })
    harness.locate = async () => { throw error }
    await assert.rejects(getCurrentPosition(), (received) => received === error)
  }
})

test('web location preserves browser success, denial and unavailable handling', async (t) => {
  harness.native = false
  harness.locate = () => assert.fail('Web must use the browser location API')
  const original = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  t.after(() => {
    if (original) Object.defineProperty(globalThis, 'navigator', original)
    else delete globalThis.navigator
  })
  const navigator = { geolocation: {
    getCurrentPosition(success, _failure, received) {
      assert.deepEqual(received, options)
      success(position)
    },
  } }
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator })
  assert.deepEqual(await getCurrentPosition(), { lat: 36.35, lng: 127.8 })
  navigator.geolocation.getCurrentPosition = (_success, failure) => failure({ message: 'Permission denied' })
  await assert.rejects(getCurrentPosition(), /Permission denied/)
  delete navigator.geolocation
  await assert.rejects(getCurrentPosition(), /geolocation-unavailable/)
})

test('location selects the nearest selectable region and ignores missing coordinates', () => {
  const regions = [
    { id: 'province', level: 'province', centroid_lat: 36.35, centroid_lng: 127.8 },
    { id: 'city', level: 'city', centroid_lat: 36.35, centroid_lng: 127.8 },
    { id: 'town', level: 'town', parent_id: 'city', centroid_lat: 36.36, centroid_lng: 127.8 },
    { id: 'unknown', level: 'town', centroid_lat: null, centroid_lng: null },
    { id: 'remote', level: 'city', centroid_lat: 37.5, centroid_lng: 127 },
  ]
  const nearest = nearestServiceRegion(regions, 36.35, 127.8)
  assert.equal(nearest.region.id, 'town')
  assert.ok(nearest.distanceKm > 1 && nearest.distanceKm < 2)
  assert.equal(nearestServiceRegion([], 36.35, 127.8), null)
  assert.equal(nearestServiceRegion([regions[3]], 36.35, 127.8), null)
})
