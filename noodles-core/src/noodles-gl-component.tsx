/**
 * NoodlesGLComponent - React component that integrates with the existing Noodles system
 * 
 * This component bridges the programmatic API with the existing Noodles.gl
 * implementation, allowing for controlled visibility of the editor while
 * maintaining the visualization output.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import type { NoodlesGL } from './noodles-gl'
import type { NoodlesProject } from './types'

/**
 * Props for the NoodlesGLComponent
 */
export interface NoodlesGLComponentProps {
  /**
   * The NoodlesGL instance to control
   */
  instance: NoodlesGL

  /**
   * Optional project to load (overrides instance project)
   */
  project?: NoodlesProject

  /**
   * Optional custom rendering function
   */
  renderVisualization?: (props: VisualizationRenderProps) => React.ReactNode
}

/**
 * Props passed to custom visualization renderer
 */
export interface VisualizationRenderProps {
  editorVisible: boolean
  layoutMode: 'split' | 'noodles-on-top' | 'output-on-top'
  showOverlay: boolean
  advancedControls: boolean
}

/**
 * NoodlesGLComponent - Main component for rendering Noodles.gl with programmatic control
 * 
 * This component provides a bridge between the NoodlesGL API and the actual
 * rendering system. It can be used standalone or with custom rendering logic.
 * 
 * @example
 * ```tsx
 * const noodles = NoodlesGL.create({ editorVisible: false });
 * 
 * function App() {
 *   return <NoodlesGLComponent instance={noodles} />;
 * }
 * ```
 */
export function NoodlesGLComponent({
  instance,
  project,
  renderVisualization,
}: NoodlesGLComponentProps) {
  const [state, setState] = useState(instance.getState())
  const mountedRef = useRef(false)

  // Subscribe to state changes from the instance
  useEffect(() => {
    const handleDataChanged = () => {
      setState(instance.getState())
    }

    const handleProjectLoaded = () => {
      setState(instance.getState())
    }

    instance.on('data-changed', handleDataChanged)
    instance.on('project-loaded', handleProjectLoaded)

    return () => {
      instance.off('data-changed', handleDataChanged)
      instance.off('project-loaded', handleProjectLoaded)
    }
  }, [instance])

  // Load project if provided
  useEffect(() => {
    if (project && !mountedRef.current) {
      mountedRef.current = true
      instance.loadProject(project)
    }
  }, [instance, project])

  // Prepare render props
  const renderProps: VisualizationRenderProps = useMemo(
    () => ({
      editorVisible: state.editorVisible,
      layoutMode: state.layoutMode,
      showOverlay: state.showOverlay,
      advancedControls: state.advancedControls,
    }),
    [state]
  )

  // If custom renderer provided, use it
  if (renderVisualization) {
    return <>{renderVisualization(renderProps)}</>
  }

  // Default rendering - this will be implemented to use the actual Noodles components
  // For now, we return a placeholder that explains the structure
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        display: 'flex',
      }}
    >
      {/* This will be replaced with actual Noodles rendering */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Visualization output area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Map and Deck.gl layers will render here */}
        </div>

        {/* Node editor (conditionally visible) */}
        {state.editorVisible && (
          <div
            style={{
              position: state.showOverlay ? 'absolute' : 'relative',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: state.showOverlay ? 'auto' : 'auto',
            }}
          >
            {/* Node editor UI will render here */}
          </div>
        )}
      </div>
    </div>
  )
}
