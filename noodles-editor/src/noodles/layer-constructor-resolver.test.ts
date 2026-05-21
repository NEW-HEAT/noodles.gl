import { SkyboxLayer } from '@deck.gl-community/layers'
import { ScatterplotLayer } from 'deck.gl'
import { describe, expect, it } from 'vitest'
import { resolveLayerConstructor } from './layer-constructor-resolver'

describe('resolveLayerConstructor', () => {
  it('resolves deck.gl layer constructors', () => {
    expect(resolveLayerConstructor('ScatterplotLayer')).toBe(ScatterplotLayer)
  })

  it('resolves deck.gl-community layer constructors', () => {
    expect(resolveLayerConstructor('SkyboxLayer')).toBe(SkyboxLayer)
  })

  it('returns null for unknown layer types', () => {
    expect(resolveLayerConstructor('MissingLayer')).toBeNull()
  })
})
