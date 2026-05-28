import { assert, type Deck } from '@deck.gl/core'
import { useCallback, useRef, useState } from 'react'
import { getTimelineStore, useTimelineStore } from '../timeline/timeline-store'
import { debugRender, debugRenderFrame } from '../utils/debug'

export const rafDriver = {
  tick: (_timestamp: number) => {},
}

function useSequenceLength() {
  return useTimelineStore(state => state.sequence.length)
}

type SaveFilePicker = (options: {
  suggestedName?: string
  types?: {
    description?: string
    accept: Record<string, string[]>
  }[]
}) => Promise<FileSystemFileHandle>

type SaveMp4Blob = (filename: string, blob: Blob) => Promise<boolean | void> | boolean | void

export type RenderCaptureResult =
  | {
      status: 'saved'
      filename: string
      width: number
      height: number
    }
  | {
      status: 'cancelled'
    }

function evenVideoDimension(value: number): number {
  const integer = Math.floor(Number.isFinite(value) ? value : 0)
  return Math.max(2, integer - (integer % 2))
}

function videoEncoderConfigError(codec: string, config: VideoEncoderConfig): Error {
  return new Error(
    `Unsupported ${codec.toUpperCase()} encoder configuration: ${config.width}x${config.height} ` +
      `${config.framerate ?? 'unknown'}fps at ${Math.round((config.bitrate ?? 0) / 1_000_000)}Mbps.`
  )
}

async function findSupportedVideoEncoderConfig(
  codec: string,
  config: VideoEncoderConfig
): Promise<VideoEncoderConfig> {
  const withoutBitrateMode: VideoEncoderConfig = { ...config }
  delete withoutBitrateMode.bitrateMode

  const candidates: VideoEncoderConfig[] = [
    config,
    { ...config, hardwareAcceleration: 'no-preference' },
    { ...config, hardwareAcceleration: 'prefer-software' },
    { ...config, bitrateMode: 'variable' },
    { ...config, hardwareAcceleration: 'no-preference', bitrateMode: 'variable' },
    { ...config, hardwareAcceleration: 'prefer-software', bitrateMode: 'variable' },
    withoutBitrateMode,
    { ...withoutBitrateMode, hardwareAcceleration: 'no-preference' },
    { ...withoutBitrateMode, hardwareAcceleration: 'prefer-software' },
  ]

  for (const candidate of candidates) {
    const result = await VideoEncoder.isConfigSupported(candidate)
    if (result.supported) {
      if (candidate !== config) {
        debugRender('Using fallback encoder configuration', candidate)
      }
      return result.config ?? candidate
    }
  }

  throw videoEncoderConfigError(codec, config)
}

const saveMp4Blob = async (filename: string, blob: Blob, saveBlob?: SaveMp4Blob) => {
  if (saveBlob) {
    const handled = await saveBlob(filename, blob)
    if (handled !== false) return
  }

  const shareFile = new File([blob], filename, { type: 'video/mp4' })
  const mobileShare = navigator as unknown as {
    canShare?: (data: ShareData) => boolean
    share?: (data: ShareData) => Promise<void>
  }
  const share = mobileShare.share?.bind(navigator)
  const canShareFile = (() => {
    try {
      return Boolean(share && mobileShare.canShare?.({ files: [shareFile] }))
    } catch {
      return false
    }
  })()

  if (share && canShareFile) {
    try {
      await share({
        files: [shareFile],
        title: filename,
      })
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        debugRender('MP4 share cancelled by user for: %s', filename)
        return
      }
      debugRender('Error sharing MP4 for', filename, ':', error)
    }
  }

  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  link.style.display = 'none'
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export const useRenderer = ({
  projectName = 'render',
  fps = 30,
  bitrate = 10_000_000, // 10mbps
  bitrateMode,
  redraw,
  saveBlob,
}: {
  projectName?: string
  fps?: number
  bitrate?: number
  bitrateMode: 'variable' | 'constant'
  redraw: () => void
  saveBlob?: SaveMp4Blob
}) => {
  // Get sequence length from the appropriate timeline system
  const sequenceLength = useSequenceLength()

  const canvasRenderDone = useRef<(result?: { error?: Error }) => void>(() => {})
  const canvasFrameReady = useCallback(
    () =>
      new Promise<{ error?: Error } | undefined>(resolve => {
        canvasRenderDone.current = resolve
      }),
    []
  )
  // The reference always points to the latest value, so the closure can't get stale
  const captureFrame = useCallback((result?: { error?: Error }) => {
    canvasRenderDone.current(result)
  }, [])

  const currentFrame = useRef(0)
  const { setPosition } = getTimelineStore()

  const startCapture = useCallback(
    async ({
      canvas,
      width,
      height,
      codec,
      startFrame = 0,
      endFrame = Math.floor(sequenceLength * fps),
    }: {
      canvas: HTMLCanvasElement
      width: number
      height: number
      codec: 'hevc' | 'avc' | 'vp9' | 'av1'
      startFrame?: number
      endFrame?: number
    }) => {
      assert(canvas, 'canvas is required')

      let i = startFrame
      const outputWidth = evenVideoDimension(width)
      const outputHeight = evenVideoDimension(height)

      setIsRendering(true)

      const outputFilename = `${projectName}-map.mp4`

      const getContainer = async (name: string) => {
        const filename = `${name}.mp4`
        const showSaveFilePicker = (
          window as Window & { showSaveFilePicker?: SaveFilePicker }
        ).showSaveFilePicker?.bind(window)
        const fileHandle = showSaveFilePicker
          ? await showSaveFilePicker({
              suggestedName: filename,
              types: [
                {
                  description: 'Video File',
                  accept: { 'video/mp4': ['.mp4'] },
                },
              ],
            }).catch((error) => {
              if (error.name === 'AbortError') {
                debugRender('File picker cancelled by user for: %s', name)
                return null
              }
              debugRender('Error in showSaveFilePicker for', name, ':', error)
              return undefined
            })
          : undefined

        if (fileHandle === null) {
          return null
        }

        const {
          BufferTarget,
          EncodedPacket,
          EncodedVideoPacketSource,
          Mp4OutputFormat,
          Output,
          StreamTarget,
        } = await import('mediabunny')

        let bufferTarget: InstanceType<typeof BufferTarget> | null = null
        const target = fileHandle
          ? new StreamTarget(
              (await fileHandle.createWritable()) as WritableStream<{
                type: 'write'
                data: Uint8Array
                position: number
              }>,
              { chunked: true }
            )
          : (bufferTarget = new BufferTarget())

        const output = new Output({
          format: new Mp4OutputFormat({
            fastStart: 'in-memory',
          }),
          target,
        })

        const videoSource = new EncodedVideoPacketSource(codec)
        output.addVideoTrack(videoSource, {
          frameRate: fps,
        })

        let currentFrameIndex = startFrame
        const videoEncoder = new VideoEncoder({
          output: (chunk, meta) => {
            // Use the simulated time as the timestamp, not the VideoFrame's real-time timestamp
            const timestamp = currentFrameIndex / fps
            const duration = 1 / fps
            const packet = EncodedPacket.fromEncodedChunk(chunk)
            // Clone the packet with the correct timestamp
            const correctedPacket = packet.clone({ timestamp, duration })
            videoSource.add(correctedPacket, meta)
            currentFrameIndex++
          },
          error: e => debugRender(e),
        })

        const codecMap = {
          hevc: {
            codec: 'hev1.1.6.L123.00',
            hevc: { format: 'annexb' },
          },
          avc: {
            codec: 'avc1.42003e',
          },
          vp9: {
            codec: 'vp09.00.10.08',
          },
          av1: {
            codec: 'v01.0.08M.10.0.110.09',
          },
        } as const

        const config = {
          width: outputWidth,
          height: outputHeight,
          bitrate,
          bitrateMode,
          hardwareAcceleration: 'prefer-hardware',
          framerate: fps,
          ...codecMap[codec],
        } as const

        const supportedConfig = await findSupportedVideoEncoderConfig(codec, config)
        videoEncoder.configure(supportedConfig)

        async function encodeFrame(data: VideoFrame) {
          const keyFrame = i % 60 === 0
          videoEncoder.encode(data, { keyFrame })
        }

        await output.start()

        async function finishEncoding() {
          await videoEncoder.flush()
          videoSource.close()
          await output.finalize()
          if (bufferTarget?.buffer) {
            await saveMp4Blob(
              filename,
              new Blob([bufferTarget.buffer], { type: 'video/mp4' }),
              saveBlob
            )
          }
        }

        return {
          videoEncoder,
          encodeFrame,
          output,
          videoSource,
          finishEncoding,
        }
      }

      function getCanvasRecorder(canvas: HTMLCanvasElement) {
        const needsResize = canvas.width !== outputWidth || canvas.height !== outputHeight
        const captureCanvas = needsResize ? document.createElement('canvas') : canvas
        let captureContext: CanvasRenderingContext2D | null = null

        if (needsResize) {
          captureCanvas.width = outputWidth
          captureCanvas.height = outputHeight
          captureContext = captureCanvas.getContext('2d')
          assert(captureContext, 'capture canvas context is required')
          captureContext.imageSmoothingEnabled = true
          captureContext.imageSmoothingQuality = 'high'
        }

        const prepareFrame = () => {
          if (!captureContext) return
          captureContext.drawImage(canvas, 0, 0, outputWidth, outputHeight)
        }

        prepareFrame()
        const track = captureCanvas.captureStream(0).getVideoTracks()[0]
        const mediaProcessor = new MediaStreamTrackProcessor({ track })
        const reader = mediaProcessor.readable.getReader()
        return { track, reader, prepareFrame }
      }

      let mapRecorder: ReturnType<typeof getCanvasRecorder> | null = null

      try {
        const mapContainer = await getContainer(`${projectName}-map`)
        if (!mapContainer) {
          debugRender('Render setup cancelled by user (map container)')
          return { status: 'cancelled' } satisfies RenderCaptureResult
        }
        const containers = new Map([['map', mapContainer]])

        mapRecorder = getCanvasRecorder(canvas)

        async function finishEncoding() {
          for (const container of containers.values()) {
            await container.finishEncoding()
          }
        }

        // Seek to start frame and wait for render to complete before capturing.
        // This prevents stale frames from being encoded if the playhead was
        // at a different position when render started.
        const warmupSimTime = startFrame / fps
        setPosition(warmupSimTime)
        redraw()

        const warmupResult = await canvasFrameReady()
        if (warmupResult?.error) {
          debugRender('Error during render warmup:', warmupResult.error)
          throw warmupResult.error
        }

        for (; i < endFrame + 1; i++) {
          const simTime = i / fps
          setPosition(simTime)
          redraw()

          currentFrame.current = i
          if (i % 10 === 0)
            debugRenderFrame('capturing frame %d/%d at simtime %d', i, endFrame, simTime)

          const canvasResult = await canvasFrameReady()

          if (canvasResult?.error) {
            debugRender('Error capturing canvas frame:', canvasResult.error)
            throw canvasResult.error
          }

          const addRecorderFrame = async (
            recorder: ReturnType<typeof getCanvasRecorder>,
            container: Awaited<ReturnType<typeof getContainer>>
          ) => {
            recorder.prepareFrame()
            // @ts-expect-error - typescript types not updated yet
            recorder.track.requestFrame()
            const result = await recorder.reader.read()
            const frame = result.value

            assert(frame, 'frame is required - might be a problem with the browser')

            await container?.encodeFrame(frame)
            frame.close()
          }

          await addRecorderFrame(mapRecorder, mapContainer)
        }
        await finishEncoding()
        return {
          status: 'saved',
          filename: outputFilename,
          width: outputWidth,
          height: outputHeight,
        } satisfies RenderCaptureResult
      } finally {
        mapRecorder?.reader?.releaseLock()
        mapRecorder?.track?.stop()
        setIsRendering(false)
      }
    },
    [projectName, sequenceLength, fps, bitrate, bitrateMode, canvasFrameReady, redraw, saveBlob, setPosition]
  )

  // Image sequence export — same frame loop as video capture, writes individual PNGs.
  const startSequenceCapture = useCallback(
    async ({
      canvas,
      getDeck,
      directoryHandle,
      captureDelay = 200,
      waitForData = true,
      startFrame = 0,
      endFrame = Math.floor(sequenceLength * fps),
      onFrameStart,
      onFrameComplete,
    }: {
      canvas: HTMLCanvasElement
      getDeck?: () => Deck | null
      directoryHandle: FileSystemDirectoryHandle
      captureDelay?: number
      waitForData?: boolean
      startFrame?: number
      endFrame?: number
      onFrameStart?: (frame: number, total: number) => void
      onFrameComplete?: (frame: number, total: number) => void
    }) => {
      assert(canvas, 'canvas is required')
      assert(directoryHandle, 'directoryHandle is required')

      setIsRendering(true)

      const totalFrames = endFrame - startFrame + 1
      const padLength = Math.max(4, String(endFrame).length)

      // For pure-deck scenes (no basemap), install a temporary onAfterRender that fires captureFrame().
      // Basemap scenes already drive frame readiness via mapProps.onIdle.
      const deck = getDeck?.()
      const originalOnAfterRender = deck?.props.onAfterRender

      if (deck) {
        deck.setProps({
          onAfterRender: context => {
            originalOnAfterRender?.(context)
            if (
              waitForData &&
              !deck.props.layers.every(l => !l || (!Array.isArray(l) && l.isLoaded))
            ) {
              debugRender('deck waiting for layers to load')
              return
            }
            setTimeout(() => captureFrame(), captureDelay)
          },
        })
      }

      // Use captureStream + requestFrame to read from the browser compositor rather than
      // the raw GL framebuffer (which is cleared after the buffer swap when
      // preserveDrawingBuffer is false).
      const track = canvas.captureStream(0).getVideoTracks()[0]
      const mediaProcessor = new MediaStreamTrackProcessor({ track })
      const reader = mediaProcessor.readable.getReader()

      // Pipelined writes: up to MAX_CONCURRENT_WRITES file writes run concurrently with
      // the next frame's render to avoid ~750ms/frame disk flush stalls.
      const MAX_CONCURRENT_WRITES = 4
      const pendingWrites: Promise<void>[] = []

      const writeFile = (filename: string, data: Blob): Promise<void> =>
        directoryHandle
          .getFileHandle(filename, { create: true })
          .then(fh => fh.createWritable())
          .then(async writable => {
            await writable.write(data)
            await writable.close()
          })

      try {
        for (let i = startFrame; i < endFrame + 1; i++) {
          onFrameStart?.(i - startFrame, totalFrames)

          const simTime = i / fps
          setPosition(simTime)
          redraw()

          currentFrame.current = i
          if (i % 10 === 0)
            debugRenderFrame('exporting frame %d/%d at simtime %d', i, endFrame, simTime)

          // Wait for frame to be ready (onAfterRender for pure-deck, onIdle for basemap)
          await canvasFrameReady()

          const frameNumber = String(i).padStart(padLength, '0')
          const filename = `${projectName}_${frameNumber}.png`

          // Drain oldest write if the queue is full before capturing the next frame
          if (pendingWrites.length >= MAX_CONCURRENT_WRITES) {
            await pendingWrites.shift()
          }

          // Capture via compositor: requestFrame reads from the display buffer, not the
          // GL buffer (which may already be cleared). Draw into OffscreenCanvas for PNG.
          // @ts-expect-error - typescript types not updated yet
          track.requestFrame()
          const { value: frame } = await reader.read()
          assert(frame, 'frame is required - might be a problem with the browser')
          const offscreen = new OffscreenCanvas(frame.displayWidth, frame.displayHeight)
          const ctx = offscreen.getContext('2d')!
          ctx.drawImage(frame, 0, 0)
          frame.close()
          const blob = await offscreen.convertToBlob({ type: 'image/png' })

          pendingWrites.push(writeFile(filename, blob))

          onFrameComplete?.(i - startFrame + 1, totalFrames)
        }

        await Promise.all(pendingWrites)
      } finally {
        reader.releaseLock()
        if (deck) {
          deck.setProps({ onAfterRender: originalOnAfterRender ?? (() => {}) })
        }
        setIsRendering(false)
      }
    },
    [projectName, sequenceLength, fps, redraw, canvasFrameReady, captureFrame, setPosition]
  )

  const [isRendering, setIsRendering] = useState(false)

  return {
    startCapture,
    startSequenceCapture,
    captureFrame,
    currentFrame: currentFrame.current,
    isRendering,
  }
}

export default useRenderer

export const captureScreenshot = async (
  suggestedName: string,
  getBufferedCanvas: () => HTMLCanvasElement,
  quality = 1
) => {
  const showSaveFilePicker = (
    window as Window & { showSaveFilePicker?: SaveFilePicker }
  ).showSaveFilePicker?.bind(window)
  if (!showSaveFilePicker) {
    throw new Error('File picker not supported')
  }

  const imageHandle = await showSaveFilePicker({
    suggestedName,
    types: [
      {
        description: 'PNG',
        accept: { 'image/png': ['.png'] },
      },
      {
        description: 'JPEG',
        accept: { 'image/jpeg': ['.jpeg'] },
      },
    ],
  })

  const file = await imageHandle.getFile()

  const blob = await new Promise<Blob>((resolve, reject) => {
    // canvas needs to redrawn immediately before capture or else buffer will be empty.
    getBufferedCanvas().toBlob(
      blob => (blob ? resolve(blob) : reject('canvas is empty')),
      file.type,
      quality
    )
  })

  const fileWritableStream = await imageHandle.createWritable()
  await fileWritableStream.write(blob)
  await fileWritableStream.close()
}
