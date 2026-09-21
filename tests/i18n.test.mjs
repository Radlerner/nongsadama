import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { appConfig, deviceLocale } from '../src/config/app.ts'

const dictionaries = Object.fromEntries(
  appConfig.supportedLocales.map((code) => [
    code,
    JSON.parse(readFileSync(new URL(`../src/i18n/dictionaries/${code}.json`, import.meta.url), 'utf8')),
  ]),
)

test('device language suggests each supported locale and preserves priority', () => {
  for (const code of appConfig.supportedLocales) {
    assert.equal(deviceLocale([`${code.toUpperCase()}-ZZ`]), code)
  }
  assert.equal(deviceLocale(['fr-FR', 'th-TH', 'en-US']), 'th')
  assert.equal(deviceLocale(['fr-FR']), 'en')
  assert.equal(deviceLocale([]), 'en')
})

test('all language dictionaries cover the same copy and placeholders', () => {
  const expected = dictionaries.en
  const keys = Object.keys(expected).sort()
  const placeholders = (value) => (value.match(/\{[a-z]+\}/g) ?? []).sort()
  for (const [code, dictionary] of Object.entries(dictionaries)) {
    assert.deepEqual(Object.keys(dictionary).sort(), keys, `${code} translation keys`)
    for (const key of keys) {
      assert.ok(dictionary[key].trim(), `${code}.${key} is empty`)
      assert.deepEqual(placeholders(dictionary[key]), placeholders(expected[key]), `${code}.${key} placeholders`)
    }
  }
})
