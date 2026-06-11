import { EditableGeoJsonLayer } from '@deck.gl-community/editable-layers'
import { PathMarkerLayer } from '@deck.gl-community/layers'
import { ScatterplotLayer } from 'deck.gl'
import { describe, expect, it } from 'vitest'
import { resolveLayerConstructor } from './layer-constructor-resolver'

describe('resolveLayerConstructor', () => {
  it('resolves deck.gl layer constructors', () => {
    expect(resolveLayerConstructor('ScatterplotLayer')).toBe(ScatterplotLayer)
  })

  it('resolves deck.gl-community layer constructors', () => {
    expect(resolveLayerConstructor('PathMarkerLayer')).toBe(PathMarkerLayer)
  })

  it('resolves editable deck.gl-community layer constructors', () => {
    expect(resolveLayerConstructor('EditableGeoJsonLayer')).toBe(EditableGeoJsonLayer)
  })

  it('returns null for unknown layer types', () => {
    expect(resolveLayerConstructor('MissingLayer')).toBeNull()
  })
})
