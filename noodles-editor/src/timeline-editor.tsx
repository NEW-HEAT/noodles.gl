import { _GlobeController as GlobeController, type Deck, type DeckProps } from '@deck.gl/core'
import { MapboxOverlay, type MapboxOverlayProps } from '@deck.gl/mapbox'
import { DeckGL } from '@deck.gl/react'
import { ReactFlowProvider } from '@xyflow/react'
import type { Map as MapLibre } from 'maplibre-gl'
import {
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import ReactMapGL, { type MapProps, useControl } from 'react-map-gl/maplibre'
import { Layout } from './layout'
import { ErrorBoundary } from './noodles/components/error-boundary'
import { TopMenuBar } from './noodles/components/top-menu-bar'
import { ExportActionsProvider } from './noodles/contexts/export-actions-context'
import { useActiveStorageType, useCurrentDirectory } from './noodles/filesystem-store'
import { useActiveOutOp } from './noodles/hooks/use-active-outop'
import { useRenderSettings } from './noodles/hooks/use-render-settings'
import { getNoodles, type EmbeddedNoodlesProject } from './noodles/noodles'
import { getOp } from './noodles/store'
import { forceUpdate } from './noodles/transform-graph'
import type { RenderSettings } from './noodles/utils/serialization'
import { useDeckDrawLoop } from './render/draw-loop'
import { captureScreenshot, useRenderer } from './render/renderer'
import { TransformScale } from './render/transform-scale'
import { CollapsibleTimelinePanel } from './timeline/components/CollapsibleTimelinePanel'
import { useTimelineStore } from './timeline/timeline-store'
import s from './timeline-editor.module.css'
import { debugRender } from './utils/debug'
import setRef from './utils/set-ref'
import { workerSetTimeout } from './utils/worker-timer'

const CAMERA_FIELD_NAMES = ['longitude', 'latitude', 'zoom', 'pitch', 'bearing'] as const

function useSequenceLength() {
  return useTimelineStore(state => state.sequence.length)
}

const DeckGLOverlay = forwardRef<
  Deck,
  MapboxOverlayProps & {
    renderer: RenderSettings
    isRendering: boolean
  }
>(({ renderer, isRendering, ...props }, ref) => {
  // MapboxOverlay handles a variety of props differently than the Deck class.
  // https://deck.gl/docs/api-reference/mapbox/mapbox-overlay#constructor
  const deck = useControl<MapboxOverlay>(() => new MapboxOverlay({ ...props, interleaved: true }))

  if (!isRendering) {
    deck.setProps({
      ...props,
      // TODO: Cleanup onAfterRender from draw loop as a post-render step instead
      onAfterRender: props.onAfterRender ? props.onAfterRender : () => {},
    })
  }

  // @ts-expect-error private property
  const deckgl = deck._deck
  // const gl = deckgl?.props.gl

  useDeckDrawLoop({
    deck: deckgl,
    isRendering,
    rendererConfig: renderer,
    props,
  })

  // @ts-expect-error private property
  setRef(ref, deck._deck)
  return null
})

const isMapReady = (map: MapLibre | null) => !map || (map.isStyleLoaded() && map.areTilesLoaded())

export interface TimelineEditorProps {
  embeddedProject?: EmbeddedNoodlesProject
  externalRuntime?: boolean
  viewport?: ReactNode
}

export default function TimelineEditor({
  embeddedProject,
  externalRuntime = false,
  viewport,
}: TimelineEditorProps = {}) {
  const mapRef = useRef<MapLibre | null>(null)
  const deckRef = useRef<Deck>(null)
  const exposedDeckRef = useRef<Deck | null>(null)
  const isRenderingRef = useRef(false)
  const [interactiveViewState, setInteractiveViewState] = useState<Record<string, unknown> | null>(
    null
  )
  const [deckReadyToken, setDeckReadyToken] = useState(0)
  // Session-only handle set by selectRendersDirectory; takes priority over project subdir
  const rendersDirectoryHandleRef = useRef<FileSystemDirectoryHandle | null>(null)

  // Trigger a redraw of React, mapbox and deck when the renderer state changes,
  // to ensure that the VideoStreamReader in renderer.ts runs
  const [, setRand] = useState(0)
  const redraw = useCallback(() => {
    mapRef.current?.redraw()
    deckRef.current?.redraw()
    // Only trigger React re-renders outside of the render loop — during export this
    // runs every frame and causes CSSStyleRule/DOM churn from React re-renders.
    if (!isRenderingRef.current) setRand(Math.random())
  }, [])

  const noodles = getNoodles({ embeddedProject, externalRuntime })
  const { flowGraph, nodeSidebar, propertiesPanel, layoutMode, ...visualization } = noodles

  // Render settings are now stored as OutOp inputs
  const renderSettings = useRenderSettings()
  // Active OutOp for updating rendersDirectory when user picks a directory
  const activeOutOp = useActiveOutOp()
  // File system state for resolving the renders directory
  const currentDirectory = useCurrentDirectory()
  const activeStorageType = useActiveStorageType()

  const sequenceLength = useSequenceLength()

  const {
    framerate,
    bitrateMbps,
    bitrateMode,
    codec,
    resolution,
    lod,
    waitForData,
    captureDelay,
    rendersDirectory,
  } = renderSettings

  const { startCapture, startSequenceCapture, captureFrame, currentFrame, isRendering } =
    useRenderer({
      projectName: noodles.projectName ?? 'render',
      fps: framerate,
      bitrate: bitrateMbps * 1_000_000,
      bitrateMode,
      redraw,
    })
  isRenderingRef.current = isRendering

  // /world is Deck-native: basemaps, terrain, drape, and interaction are all
  // deck.gl layers/views. MapLibre remains available in older noodles examples,
  // but this embedded renderer intentionally never mounts ReactMapGL.
  const basemapEnabled = false
  // console.log(rgbaToClearColor(mapState.background))
  const latestViewStateRef = useRef<Record<string, unknown>>({})
  const lastInteractiveCommitRef = useRef(0)

  useEffect(() => {
    const graphViewState = visualization.deckProps?.viewState as Record<string, unknown> | undefined
    if (!graphViewState) return
    if (Date.now() - lastInteractiveCommitRef.current < 5_000) return
    latestViewStateRef.current = graphViewState
    setInteractiveViewState(graphViewState)
  }, [visualization.deckProps?.viewState])

  const commitDeckViewState = useCallback(
    (nextViewState: Record<string, unknown>) => {
      const graphViewState = Object.fromEntries(
        CAMERA_FIELD_NAMES.flatMap(fieldName => {
          const value = nextViewState[fieldName]
          return typeof value === 'number' ? [[fieldName, value]] : []
        })
      )
      const debugWindow = window as Window & {
        __deckViewStateChanges?: Array<Record<string, unknown>>
      }
      debugWindow.__deckViewStateChanges = [
        ...(debugWindow.__deckViewStateChanges ?? []),
        graphViewState,
      ].slice(-10)
      lastInteractiveCommitRef.current = Date.now()
      latestViewStateRef.current = graphViewState
      setInteractiveViewState(graphViewState)

      const viewStateOp = getOp('/view-state') as
        | {
            inputs?: Record<
              string,
              { setValue?: (value: unknown) => void; next?: (value: unknown) => void }
            >
          }
        | undefined

      for (const fieldName of CAMERA_FIELD_NAMES) {
        const value = nextViewState[fieldName]
        if (typeof value !== 'number') continue
        const field = viewStateOp?.inputs?.[fieldName]
        if (field?.setValue) field.setValue(value)
        else field?.next?.(value)
      }

      forceUpdate()
    },
    []
  )

  const onDeckViewStateChange = useCallback<NonNullable<DeckProps['onViewStateChange']>>(
    params => {
      if (Date.now() - lastInteractiveCommitRef.current < 5_000) return
      commitDeckViewState(params.viewState as Record<string, unknown>)
      visualization.deckProps?.onViewStateChange?.(params)
    },
    [commitDeckViewState, visualization.deckProps]
  )

  useEffect(() => {
    if (basemapEnabled) return
    const deck = deckRef.current
    // @ts-expect-error canvas is protected but accessible for embedded diagnostics.
    const canvas = deck?.canvas as HTMLCanvasElement | undefined
    if (!canvas) return
    ;(window as Window & { __deckNativeBridgeAttached?: boolean }).__deckNativeBridgeAttached = true

    let lastPointer: { x: number; y: number } | null = null

    const currentViewState = () => latestViewStateRef.current
    const numeric = (key: (typeof CAMERA_FIELD_NAMES)[number], fallback: number) => {
      const value = currentViewState()[key]
      return typeof value === 'number' ? value : fallback
    }

    const onWheel = (event: WheelEvent) => {
      event.preventDefault()
      const zoom = Math.max(0, Math.min(20, numeric('zoom', 1.5) - event.deltaY * 0.002))
      commitDeckViewState({ ...currentViewState(), zoom })
    }

    const onPointerDown = (event: PointerEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY }
      canvas.setPointerCapture?.(event.pointerId)
    }

    const onPointerMove = (event: PointerEvent) => {
      if (!lastPointer) return
      const zoomScale = Math.max(1, 2 ** numeric('zoom', 1.5))
      const dx = event.clientX - lastPointer.x
      const dy = event.clientY - lastPointer.y
      lastPointer = { x: event.clientX, y: event.clientY }

      const longitude = numeric('longitude', 0) - (dx * 0.35) / zoomScale
      const latitude = Math.max(
        -85,
        Math.min(85, numeric('latitude', 20) + (dy * 0.35) / zoomScale)
      )
      commitDeckViewState({ ...currentViewState(), longitude, latitude })
    }

    const onPointerUp = (event: PointerEvent) => {
      lastPointer = null
      canvas.releasePointerCapture?.(event.pointerId)
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      canvas.removeEventListener('pointercancel', onPointerUp)
    }
  }, [basemapEnabled, commitDeckViewState, deckReadyToken])

  // Track deck.gl rendering stats for Claude AI debugging
  const lastFrameTimeRef = useRef(Date.now())
  const fpsRef = useRef(0)

  const graphViews = visualization.deckProps?.views
  const graphViewList = Array.isArray(graphViews) ? graphViews : graphViews ? [graphViews] : []
  const hasInteractiveGlobeView = graphViewList.some(
    view =>
      view.constructor.name.includes('Globe') &&
      (view.props.controller === true || typeof view.props.controller === 'object')
  )

  const deckProps: DeckProps = {
    deviceProps: {
      type: 'webgl',
      powerPreference: 'high-performance',
      webgl: {
        stencil: true,
      },
    },
    useDevicePixels: false,
    ...visualization.deckProps,
    controller:
      visualization.deckProps?.controller ?? (hasInteractiveGlobeView ? GlobeController : undefined),
    viewState: interactiveViewState ?? visualization.deckProps?.viewState,
    onViewStateChange: onDeckViewStateChange,
    onDeviceInitialized: device => {
      visualization.deckProps?.onDeviceInitialized?.(device)
      redraw()
    },
    onAfterRender: () => {
      visualization.deckProps?.onAfterRender?.()

      // Track FPS and stats for Claude AI debugging
      // Use deck.gl's built-in fps metric when available
      const now = Date.now()
      const deltaTime = now - lastFrameTimeRef.current
      lastFrameTimeRef.current = now
      const calculatedFps = deltaTime > 0 ? Math.round(1000 / deltaTime) : 0

      // Prefer deck.gl's built-in fps metric
      const deckFps = deckRef.current?.metrics?.fps
      fpsRef.current = deckFps !== undefined ? deckFps : calculatedFps

      // Expose stats globally for MCPTools
      ;(window as Window & { __deckStats?: Record<string, unknown> }).__deckStats = {
        fps: fpsRef.current,
        lastFrameTime: deltaTime,
        layerCount: deckRef.current?.layerManager?.getLayers().length || 0,
        timestamp: now,
      }
    },
  }

  // Destructure light and sky since they're applied imperatively via setLight/setSky
  const { light, sky, ...basemapProps } = visualization.mapProps ?? {}
  const mapProps: MapProps = {
    interactive: false,
    antialias: true,
    preserveDrawingBuffer: true,
    onLoad: ({ target: map }) => {
      // Redraw react to ensure hooks check for map ref changes
      mapRef.current = map
      redraw()
    },
    ...basemapProps,
    maxPitch: Math.min(basemapProps?.maxPitch ?? 85, 85),
  }

  // Apply light and sky settings imperatively to avoid style reloading
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.isStyleLoaded()) return

    // Note: light settings only apply to globe projection
    if (light) {
      map.setLight({
        anchor: light.anchor,
        position: [1.15, light.azimuthal, light.polar],
      })
    }

    if (sky?.enabled) {
      // Note: skyColor, horizonColor, skyHorizonBlend only apply to mercator projection
      // Note: atmosphereBlend only applies to globe projection
      map.setSky({
        'sky-color': sky.skyColor,
        'horizon-color': sky.horizonColor,
        'sky-horizon-blend': sky.skyHorizonBlend,
        'atmosphere-blend': sky.atmosphereBlend,
      })
    } else {
      // Disable sky - requires MapLibre GL JS 4.6.0+
      map.setSky(undefined)
    }
  }, [light, sky])
  // Expose deck.gl canvas and instance for Claude AI visual debugging
  useEffect(() => {
    if (deckRef.current) {
      // @ts-expect-error canvas is protected but accessible
      const canvas = deckRef.current.canvas
      if (canvas) {
        // Store canvas globally for MCPTools to access
        ;(window as Window & { __deckCanvas?: unknown }).__deckCanvas = canvas
      }
      // Store deck instance globally for layer inspection
      ;(window as Window & { __deckInstance?: unknown }).__deckInstance = deckRef.current
    }
  }, [])

  // onIdle resolves when all data is loaded and drawing has settled.
  mapProps.onIdle = ({ target: map }) => {
    mapRef.current = map
    // Wait for map tiles to load before capturing.
    if (!isMapReady(map)) {
      debugRender('map waiting')
      return
    }
    // During rendering with waitForData, also confirm deck layers have finished loading.
    // mapIdle fires on map tile/style readiness only — it doesn't know about deck layer data.
    if (isRenderingRef.current && waitForData) {
      const deck = deckRef.current
      if (
        deck &&
        !deck.props.layers.every(layer => !layer || (!Array.isArray(layer) && layer.isLoaded))
      ) {
        debugRender('map idle, waiting for deck layers')
        return
      }
    }
    // This should alert the renderer that the scene is ready to be captured
    // Because onIdle can be synchronous, we need to defer the promise resolution to the next tick.
    // TODO: Perhaps set up the promises refs before the render loop, and then later await the Promise.all?
    // Delay rendering by 200ms so that deck and maplibre can settle before capturing.
    // Use worker timer so this fires even when the tab is switched.
    workerSetTimeout(() => captureFrame(), captureDelay)
  }

  const pureDeckInstance = !basemapEnabled ? deckRef.current : null
  useDeckDrawLoop({
    deck: pureDeckInstance,
    isRendering,
    captureFrame,
    rendererConfig: {
      waitForData,
      captureDelay,
    },
    props: deckProps,
  })

  const startRender = useCallback(async () => {
    let canvas: HTMLCanvasElement | null = null

    if (basemapEnabled) {
      if (!mapRef.current) {
        debugRender('Start Render: maplibre is not defined (when basemapEnabled is true)')
        return
      }
      canvas = mapRef.current.getCanvas()
    } else {
      // Pure Deck.gl mode
      if (!deckRef.current) {
        debugRender('Start Render: deckRef is not defined (when basemapEnabled is false)')
        return
      }
      // @ts-expect-error canvas is protected but accessible
      canvas = deckRef.current.canvas
    }

    if (!canvas) {
      debugRender('Start Render: Failed to get canvas element')
      return
    }

    await startCapture({
      canvas,
      codec,
      // This always scales the video to the specified value, regardless of `canvas` size
      ...resolution,
    })
  }, [startCapture, codec, resolution, basemapEnabled])

  const takeScreenshot = useCallback(async () => {
    if (!deckRef.current) {
      debugRender('Take Screenshot: deck is not defined')
      return
    }
    if (basemapEnabled && !mapRef.current) {
      debugRender('Take Screenshot: maplibre is not defined')
      return
    }

    const suggestedName = noodles.projectName ?? 'screenshot'
    await captureScreenshot(suggestedName, () => {
      redraw()
      // @ts-expect-error canvas is protected
      return deckRef.current.canvas!
    })
  }, [noodles.projectName, redraw, basemapEnabled])

  const selectRendersDirectory = useCallback(async () => {
    try {
      const handle = await window.showDirectoryPicker({ mode: 'readwrite' })
      rendersDirectoryHandleRef.current = handle
      // Persist the folder name to the OutOp so it survives project reloads
      activeOutOp?.inputs.rendersDirectory.setValue(handle.name)
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') throw e
    }
  }, [activeOutOp])

  const exportSequence = useCallback(async () => {
    if (!deckRef.current) {
      debugRender('Export Sequence: deck is not defined')
      return
    }
    if (basemapEnabled && !mapRef.current) {
      debugRender('Export Sequence: maplibre is not defined')
      return
    }

    // Resolve the target directory: session-picked handle > project subdir > user picker
    let rendersDir: FileSystemDirectoryHandle
    if (rendersDirectoryHandleRef.current) {
      rendersDir = rendersDirectoryHandleRef.current
    } else if (activeStorageType !== 'publicFolder' && currentDirectory) {
      try {
        rendersDir = await currentDirectory.getDirectoryHandle(rendersDirectory || 'renders', {
          create: true,
        })
      } catch (e) {
        debugRender('Failed to create renders directory: %o, falling back to picker', e)
        try {
          rendersDir = await window.showDirectoryPicker({ mode: 'readwrite' })
        } catch (err) {
          if ((err as DOMException).name === 'AbortError') return
          throw err
        }
      }
    } else {
      try {
        rendersDir = await window.showDirectoryPicker({ mode: 'readwrite' })
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return
        throw e
      }
    }

    let canvas: HTMLCanvasElement
    if (basemapEnabled) {
      canvas = mapRef.current!.getCanvas()
    } else {
      // @ts-expect-error canvas is protected
      canvas = deckRef.current.canvas!
    }

    await startSequenceCapture({
      canvas,
      // Basemap scenes use mapProps.onIdle for frame readiness; pure-deck scenes need
      // onAfterRender wired up inside startSequenceCapture via getDeck.
      getDeck: basemapEnabled ? undefined : () => deckRef.current,
      directoryHandle: rendersDir,
      captureDelay,
      waitForData,
      startFrame: 0,
      endFrame: Math.floor(sequenceLength * framerate),
      onFrameStart: (frame, total) => debugRender('Exporting frame %d/%d', frame + 1, total),
      onFrameComplete: (frame, total) => debugRender('Completed frame %d/%d', frame, total),
    })
  }, [
    startSequenceCapture,
    sequenceLength,
    framerate,
    captureDelay,
    waitForData,
    rendersDirectory,
    basemapEnabled,
    currentDirectory,
    activeStorageType,
  ])

  // Increase the render target resolution to increase map tile detail.
  // To convert viewport bounds back to their original size, add about 1 to the zoom value.
  const lodResolution = {
    width: Math.round(resolution.width * lod),
    height: Math.round(resolution.height * lod),
  }

  // Use fixed resolution for 'fixed' display mode, undefined for 'responsive' mode to use natural dimensions
  const isFixedMode = renderSettings.display === 'fixed'
  const displayResolution = isFixedMode ? lodResolution : undefined

  const renderContent = () => {
    if (viewport !== undefined) {
      return viewport
    }
    if (basemapEnabled) {
      return (
        <ReactMapGL style={displayResolution} {...mapProps}>
          <DeckGLOverlay
            ref={deckRef}
            renderer={renderSettings}
            isRendering={isRendering}
            {...deckProps}
          />
        </ReactMapGL>
      )
    }
    return (
      <DeckGL
        ref={ref => {
          const deck = ref?.deck
          setRef(deckRef, deck)
          if (!deck) return
          if (exposedDeckRef.current !== deck) {
            exposedDeckRef.current = deck
            setDeckReadyToken(token => token + 1)
          }

          // @ts-expect-error canvas is protected but accessible for embedded diagnostics.
          const canvas = deck.canvas
          if (canvas) {
            ;(window as Window & { __deckCanvas?: unknown }).__deckCanvas = canvas
          }
          ;(window as Window & { __deckInstance?: unknown }).__deckInstance = deck

          const bridgedDeck = deck as Deck & { __newHeatBridgeAttached?: boolean }
          if (!bridgedDeck.__newHeatBridgeAttached && canvas) {
            bridgedDeck.__newHeatBridgeAttached = true
            ;(window as Window & { __deckNativeBridgeAttached?: boolean }).__deckNativeBridgeAttached =
              true

            let lastPointer: { x: number; y: number } | null = null
            const currentViewState = () => latestViewStateRef.current
            const numeric = (key: (typeof CAMERA_FIELD_NAMES)[number], fallback: number) => {
              const value = currentViewState()[key]
              return typeof value === 'number' ? value : fallback
            }

            canvas.addEventListener(
              'wheel',
              event => {
                event.preventDefault()
                const zoom = Math.max(
                  0,
                  Math.min(20, numeric('zoom', 1.5) - event.deltaY * 0.002)
                )
                commitDeckViewState({ ...currentViewState(), zoom })
              },
              { passive: false }
            )
            canvas.addEventListener('pointerdown', event => {
              lastPointer = { x: event.clientX, y: event.clientY }
              canvas.setPointerCapture?.(event.pointerId)
            })
            canvas.addEventListener('pointermove', event => {
              if (!lastPointer) return
              const zoomScale = Math.max(1, 2 ** numeric('zoom', 1.5))
              const dx = event.clientX - lastPointer.x
              const dy = event.clientY - lastPointer.y
              lastPointer = { x: event.clientX, y: event.clientY }
              commitDeckViewState({
                ...currentViewState(),
                longitude: numeric('longitude', 0) - (dx * 0.35) / zoomScale,
                latitude: Math.max(
                  -85,
                  Math.min(85, numeric('latitude', 20) + (dy * 0.35) / zoomScale)
                ),
              })
            })
            const onPointerDone = (event: PointerEvent) => {
              lastPointer = null
              canvas.releasePointerCapture?.(event.pointerId)
            }
            canvas.addEventListener('pointerup', onPointerDone)
            canvas.addEventListener('pointercancel', onPointerDone)
          }
        }}
        {...deckProps}
        {...(displayResolution || {})}
      />
    )
  }

  const topBar = (
    <TopMenuBar
      projectName={noodles.projectName}
      onSaveProject={noodles.onSaveProject!}
      onSaveAs={noodles.onSaveAs}
      onRename={noodles.onRename}
      onDownload={noodles.onDownload}
      onNewProject={noodles.onNewProject!}
      onImport={noodles.onImport!}
      onOpen={noodles.onOpen}
      onOpenAddNode={noodles.onOpenAddNode}
      showChatPanel={noodles.showChatPanel}
      onChangeShowChatPanel={noodles.onChangeShowChatPanel}
      undoRedoRef={noodles.undoRedoRef!}
      copyControlsRef={noodles.copyControlsRef!}
      reactFlowRef={noodles.reactFlowRef}
      startRender={startRender}
      takeScreenshot={takeScreenshot}
      isRendering={isRendering}
      hasUnsavedChanges={noodles.hasUnsavedChanges}
      showOverlay={noodles.showOverlay}
      onChangeShowOverlay={noodles.onChangeShowOverlay}
      showDebugInfo={noodles.showDebugInfo}
      onChangeShowDebugInfo={noodles.onChangeShowDebugInfo}
      layoutMode={noodles.layoutMode}
      onChangeLayoutMode={noodles.onChangeLayoutMode}
    />
  )

  return (
    <>
      {isRendering && (
        <div className={s.actionButtons}>
          <progress
            max={sequenceLength * renderSettings.framerate}
            value={currentFrame}
            title={`Rendered ${currentFrame} / ${sequenceLength * renderSettings.framerate}`}
          />
        </div>
      )}
      <ReactFlowProvider>
        <ExportActionsProvider
          startRender={startRender}
          takeScreenshot={takeScreenshot}
          exportSequence={exportSequence}
          selectRendersDirectory={selectRendersDirectory}
          isRendering={isRendering}
        >
          <Layout
            top={topBar}
            left={nodeSidebar}
            right={propertiesPanel}
            bottom={<CollapsibleTimelinePanel />}
            flowGraph={flowGraph}
            layoutMode={layoutMode}
          >
            {isFixedMode ? (
              <TransformScale scale={renderSettings.scaleControl}>
                <ErrorBoundary title="Visualization Error">{renderContent()}</ErrorBoundary>
              </TransformScale>
            ) : (
              <ErrorBoundary title="Visualization Error">{renderContent()}</ErrorBoundary>
            )}
          </Layout>
        </ExportActionsProvider>
      </ReactFlowProvider>
    </>
  )
}
