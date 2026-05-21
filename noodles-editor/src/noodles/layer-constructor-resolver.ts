import * as deckCommunityLayers from '@deck.gl-community/layers'
import * as deck from 'deck.gl'

export type DeckLayerConstructor = new (props: Record<string, unknown>) => unknown

const deckLayerConstructors = deck as unknown as Record<string, unknown>
const communityLayerConstructors = deckCommunityLayers as unknown as Record<string, unknown>

export function resolveLayerConstructor(type: string): DeckLayerConstructor | null {
  const LayerClass = deckLayerConstructors[type] ?? communityLayerConstructors[type]

  return typeof LayerClass === 'function' ? (LayerClass as DeckLayerConstructor) : null
}
