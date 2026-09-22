import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { registerHooks } from 'node:module'
import { createElement, useContext } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import ts from 'typescript'
import { appConfig, deviceLocale } from '../src/config/app.ts'

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (context.parentURL?.endsWith('/src/i18n/I18nContext.tsx')) {
      if (specifier === '../config/app') return nextResolve(`${specifier}.ts`, context)
      if (specifier === './dictionaries') return nextResolve('./dictionaries/index.ts', context)
    }
    return nextResolve(specifier, context)
  },
  load(url, context, nextLoad) {
    if (url.includes('/src/i18n/dictionaries/') && url.endsWith('.json')) {
      return { format: 'module', shortCircuit: true, source: `export default ${readFileSync(new URL(url), 'utf8')}` }
    }
    if (url.endsWith('/src/i18n/I18nContext.tsx')) {
      return {
        format: 'module', shortCircuit: true,
        source: ts.transpileModule(readFileSync(new URL(url), 'utf8'), {
          compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, jsx: ts.JsxEmit.ReactJSX },
        }).outputText,
      }
    }
    return nextLoad(url, context)
  },
})
const { I18nProvider, I18nContext } = await import('../src/i18n/I18nContext.tsx')

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

test('language provider restores saved choices before device recommendations without marking defaults explicit', (t) => {
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window')
  const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator')
  t.after(() => {
    for (const [key, descriptor] of [['window', originalWindow], ['navigator', originalNavigator]]) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const storage = new Map()
  const navigator = { languages: ['th-TH'], language: 'th-TH' }
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: { getItem: (key) => storage.get(key) ?? null } } })
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: navigator })
  let value
  function Probe() {
    value = useContext(I18nContext)
    return null
  }
  const render = () => renderToStaticMarkup(createElement(I18nProvider, null, createElement(Probe)))
  for (const locale of appConfig.supportedLocales) {
    navigator.languages = [`${locale}-ZZ`]
    render()
    assert.equal(value.locale, locale)
    assert.equal(value.localeExplicit, false)
    assert.equal(value.t('select.recommended'), dictionaries[locale]['select.recommended'])
  }
  storage.set('nongsadama.locale', 'vi')
  render()
  assert.equal(value.locale, 'vi')
  assert.equal(value.localeExplicit, true)
  storage.set('nongsadama.locale.explicit', 'false')
  render()
  assert.equal(value.locale, 'vi')
  assert.equal(value.localeExplicit, false)
  storage.set('nongsadama.locale', 'unsupported')
  navigator.languages = []
  render()
  assert.equal(value.locale, 'th')
  assert.equal(value.localeExplicit, false)
})
