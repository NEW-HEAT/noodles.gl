/**
 * LayerFactory - Handles instantiation of Deck.gl layers and extensions from POJOs
 */

import * as deck from 'deck.gl'
import type { LayerExtension } from 'deck.gl'

export interface LayerSpec {
  type: string
  extensions?: ExtensionSpec[]
  [key: string]: any
}

export interface ExtensionSpec {
  type: string
  [key: string]: any
}

export interface ExtensionMap {
  [key: string]: (new (...args: any[]) => LayerExtension) | { ExtensionClass: new (...args: any[]) => LayerExtension, args: any }
}

export class LayerFactory {
  private extensionMap: ExtensionMap = {}

  constructor() {}

  /**
   * Set the extension map (from noodles-editor)
   */
  setExtensionMap(map: ExtensionMap): void {
    this.extensionMap = map
  }

  /**
   * Instantiate Deck.gl layers from POJO specifications
   */
  instantiateLayers(layerSpecs: LayerSpec[]): any[] {
    return layerSpecs.map(layerSpec => this.instantiateLayer(layerSpec))
  }

  /**
   * Instantiate a single layer from POJO specification
   */
  private instantiateLayer(layerSpec: LayerSpec): any {
    const { type, extensions, ...layerProps } = layerSpec

    // Instantiate extensions if present
    let instantiatedExtensions: LayerExtension[] | undefined
    if (extensions && Array.isArray(extensions)) {
      instantiatedExtensions = this.instantiateExtensions(extensions)
    }

    // Create layer instance
    const LayerClass = (deck as any)[type]
    if (!LayerClass) {
      console.warn(`Unknown layer type: ${type}`)
      return null
    }

    return new LayerClass({
      ...layerProps,
      ...(instantiatedExtensions && instantiatedExtensions.length > 0
        ? { extensions: instantiatedExtensions }
        : {})
    })
  }

  /**
   * Instantiate extensions from POJO specifications
   */
  private instantiateExtensions(extensionSpecs: ExtensionSpec[]): LayerExtension[] {
    return extensionSpecs
      .map(extSpec => {
        const { type: extType, ...constructorArgs } = extSpec
        const extensionDef = this.extensionMap[extType]

        if (!extensionDef) {
          console.warn(`Unknown extension type: ${extType}`)
          return null
        }

        // Check if it's a wrapped extension (with ExtensionClass and args)
        if (typeof extensionDef === 'object' && 'ExtensionClass' in extensionDef) {
          return new extensionDef.ExtensionClass(extensionDef.args)
        }

        // It's a direct class constructor
        const ExtensionClass = extensionDef as new (...args: unknown[]) => LayerExtension
        return Object.keys(constructorArgs).length > 0
          ? new ExtensionClass(constructorArgs)
          : new ExtensionClass()
      })
      .filter((e): e is LayerExtension => e !== null)
  }

  /**
   * Process visualization props, instantiating layers from POJOs
   */
  processVisualizationProps(visProps: any): any {
    if (!visProps || !visProps.deckProps?.layers) {
      return visProps
    }

    const { layers, ...otherDeckProps } = visProps.deckProps
    const instantiatedLayers = this.instantiateLayers(layers)

    return {
      deckProps: {
        ...otherDeckProps,
        layers: instantiatedLayers
      },
      mapProps: visProps.mapProps
    }
  }
}
