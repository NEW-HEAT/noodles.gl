# Noodles.gl Programmatic API Integration Guide

This guide explains how to integrate Noodles.gl into your application using the `@noodles-gl/core` API package.

## Overview

The `@noodles-gl/core` package provides a programmatic interface to Noodles.gl that allows you to:

1. **Toggle node editor visibility** - Show/hide the advanced editor while keeping the map
2. **Use headless visualization** - Render only the map output without any editor UI
3. **Feed data programmatically** - Set operator data from your application
4. **Synchronize rendering** - Integrate with external multimedia rendering pipelines
5. **Control advanced features** - Expose or hide advanced editing capabilities

## Installation

```bash
npm install @noodles-gl/core
# or
yarn add @noodles-gl/core
```

## Basic Integration Patterns

### Pattern 1: Simple Viewer (Editor Hidden)

Perfect for embedding visualizations in dashboards or presentations where you want to show the map without editing capabilities.

```tsx
import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core';
import { useState } from 'react';

function SimpleMapViewer({ projectData }) {
  const [noodles] = useState(() => 
    NoodlesGL.create({
      editorVisible: false,      // Hide the node editor
      project: projectData,       // Load your project
      layoutMode: 'output-on-top' // Show only the map
    })
  );

  return (
    <div style={{ width: '100%', height: '600px' }}>
      <NoodlesGLComponent instance={noodles} />
    </div>
  );
}
```

### Pattern 2: Toggleable Advanced Mode

Ideal for applications where you want to provide a simple interface by default but allow power users to access advanced features.

```tsx
import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core';
import { useState } from 'react';

function MapWithAdvancedMode({ projectData }) {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [noodles] = useState(() => 
    NoodlesGL.create({
      editorVisible: false,
      project: projectData,
      advancedControls: false  // Disable advanced features initially
    })
  );

  const toggleAdvancedMode = () => {
    const newState = !showAdvanced;
    setShowAdvanced(newState);
    noodles.setEditorVisibility(newState);
  };

  return (
    <div>
      <button onClick={toggleAdvancedMode}>
        {showAdvanced ? 'Simple Mode' : 'Advanced Mode'}
      </button>
      <NoodlesGLComponent instance={noodles} />
    </div>
  );
}
```

### Pattern 3: Programmatic Data Feed

Use this when you want to feed data from your application into the visualization system.

```tsx
import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core';
import { useState, useEffect } from 'react';

function DynamicMapVisualization({ projectData }) {
  const [noodles] = useState(() => 
    NoodlesGL.create({
      editorVisible: false,
      project: projectData
    })
  );

  // Feed data from your application
  useEffect(() => {
    const fetchData = async () => {
      const data = await fetch('/api/geojson-data').then(r => r.json());
      
      // Set data for a specific operator in the graph
      noodles.setData('/data-loader', data);
    };

    fetchData();
    
    // Update data periodically
    const interval = setInterval(fetchData, 30000); // Every 30 seconds
    return () => clearInterval(interval);
  }, [noodles]);

  // Listen for visualization events
  useEffect(() => {
    const handleRender = (frameData) => {
      console.log('Visualization rendered:', frameData);
    };

    noodles.on('render', handleRender);
    return () => noodles.off('render', handleRender);
  }, [noodles]);

  return <NoodlesGLComponent instance={noodles} />;
}
```

### Pattern 4: Unified Multimedia Export

For integrating Noodles.gl with video rendering or multimedia content creation systems.

```tsx
import { NoodlesGL, createVisualizationRenderer } from '@noodles-gl/core';

class MultimediaExporter {
  private noodles: NoodlesGL;
  private renderer: VisualizationRenderer;

  constructor(projectData, videoEncoder) {
    // Create renderer that captures frames
    this.renderer = createVisualizationRenderer({
      width: 1920,
      height: 1080,
      onFrame: (canvas, frameData) => {
        // Integrate with your video encoder
        videoEncoder.addFrame(canvas, frameData.timestamp);
      },
      onComplete: () => {
        console.log('Export complete');
      }
    });

    // Create Noodles instance in external rendering mode
    this.noodles = NoodlesGL.create({
      editorVisible: false,
      project: projectData,
      renderMode: 'external',
      onFrame: this.renderer.captureFrame.bind(this.renderer)
    });
  }

  async export(duration: number, fps: number = 30) {
    this.renderer.start();
    
    const totalFrames = duration * fps;
    for (let frame = 0; frame < totalFrames; frame++) {
      const timestamp = frame / fps;
      
      // Seek to timestamp
      this.noodles.seekTo(timestamp);
      
      // Render frame
      this.noodles.renderFrame({
        timestamp,
        frameNumber: frame,
        isLastFrame: frame === totalFrames - 1
      });
      
      // Allow other operations
      await new Promise(resolve => setTimeout(resolve, 0));
    }
  }
}

// Usage
const exporter = new MultimediaExporter(myProject, myVideoEncoder);
await exporter.export(10); // Export 10 seconds
```

## API Reference

### NoodlesGL Class

#### `NoodlesGL.create(options)`

Creates a new Noodles.gl instance.

**Options:**
- `editorVisible` (boolean): Show/hide node editor. Default: `true`
- `project` (NoodlesProject): Project configuration to load
- `renderMode` ('standalone' | 'external'): Rendering mode. Default: `'standalone'`
- `onFrame` (function): Callback for external rendering mode
- `advancedControls` (boolean): Enable advanced editing. Default: `false`
- `layoutMode` ('split' | 'noodles-on-top' | 'output-on-top'): Layout mode. Default: `'split'`
- `showOverlay` (boolean): Show overlay. Default: `true`

#### Instance Methods

- `setEditorVisibility(visible: boolean)` - Show/hide the node editor
- `loadProject(project: NoodlesProject)` - Load a new project
- `setData(operatorId: string, data: unknown)` - Set data for an operator
- `getData(operatorId: string)` - Get output data from an operator
- `seekTo(time: number)` - Seek to a timeline position (seconds)
- `play()` - Start timeline playback
- `pause()` - Pause timeline playback
- `setLayoutMode(mode)` - Change layout mode
- `setShowOverlay(show: boolean)` - Toggle overlay visibility
- `on(event: string, callback: Function)` - Add event listener
- `off(event: string, callback: Function)` - Remove event listener
- `renderFrame(frameData: FrameData)` - Render a frame (external mode)
- `getState()` - Get current state
- `destroy()` - Clean up resources

#### Events

- `'render'` - Emitted when a frame is rendered
  - Payload: `FrameData`
- `'data-changed'` - Emitted when operator data changes
  - Payload: `{ operatorId?: string, data?: unknown, ... }`
- `'project-loaded'` - Emitted when a project is loaded
  - Payload: `NoodlesProject`
- `'timeline-changed'` - Emitted when timeline changes
  - Payload: `{ time?: number, playing?: boolean }`

### NoodlesGLComponent

React component for rendering Noodles.gl.

**Props:**
- `instance` (NoodlesGL): The Noodles.gl instance to render (required)
- `project` (NoodlesProject): Optional project to load
- `renderVisualization` (function): Optional custom renderer

### Utilities

#### `createVisualizationRenderer(options)`

Creates a renderer for external multimedia integration.

**Options:**
- `canvas` (HTMLCanvasElement): Canvas to render to (optional)
- `width` (number): Canvas width. Default: `1920`
- `height` (number): Canvas height. Default: `1080`
- `onFrame` (function): Frame callback `(canvas, frameData) => void`
- `onComplete` (function): Completion callback

**Returns:** `VisualizationRenderer`

#### `createHeadlessVisualization(options)`

Creates a minimal visualization without UI (coming soon).

## Project Configuration

A Noodles.gl project is a JSON object with this structure:

```typescript
interface NoodlesProject {
  version: number;              // Schema version (currently 6)
  nodes: Array<{
    id: string;                 // Unique operator ID (e.g., '/data-loader')
    type: string;               // Operator type (e.g., 'FileOp')
    position: { x: number; y: number };
    data: {
      inputs: Record<string, unknown>;
    };
  }>;
  edges: Array<{
    id: string;
    source: string;             // Source operator ID
    target: string;             // Target operator ID
    sourceHandle: string;       // Output field name
    targetHandle: string;       // Input field name
  }>;
  viewport?: { x: number; y: number; zoom: number };
  timeline?: Record<string, unknown>;
  editorSettings?: {
    layoutMode?: 'split' | 'noodles-on-top' | 'output-on-top';
    showOverlay?: boolean;
  };
}
```

You can create projects programmatically or load them from the Noodles.gl editor.

## Best Practices

### 1. State Management

Keep the Noodles.gl instance in React state to avoid recreating it:

```tsx
const [noodles] = useState(() => NoodlesGL.create({ /* options */ }));
```

### 2. Event Cleanup

Always clean up event listeners in useEffect:

```tsx
useEffect(() => {
  const handler = () => { /* ... */ };
  noodles.on('render', handler);
  return () => noodles.off('render', handler);
}, [noodles]);
```

### 3. Resource Cleanup

Destroy the instance when the component unmounts:

```tsx
useEffect(() => {
  return () => noodles.destroy();
}, [noodles]);
```

### 4. Progressive Enhancement

Start simple and progressively enable features:

```tsx
// Start with simple viewer
const [mode, setMode] = useState('simple');

// Enable editor when needed
if (mode === 'advanced') {
  noodles.setEditorVisibility(true);
}
```

### 5. Error Handling

Wrap operations in try-catch for robustness:

```tsx
try {
  await noodles.loadProject(projectData);
} catch (error) {
  console.error('Failed to load project:', error);
  // Show error to user
}
```

## Examples

See the `/examples` directory for complete working examples:

- **simple-viewer.tsx** - Basic usage with hidden editor
- **toggle-editor.tsx** - Toggleable advanced mode
- **programmatic-data.tsx** - Dynamic data feeding
- **external-rendering.tsx** - Multimedia integration

## Next Steps

- Explore the [full API documentation](./API.md)
- Check out [example projects](../examples/)
- Learn about [operator types and capabilities](https://noodles.gl/docs/developers/operators)
- Join the community on [GitHub](https://github.com/NEW-HEAT/noodles.gl)
