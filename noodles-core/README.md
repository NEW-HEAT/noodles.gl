# @noodles-gl/core

Programmatic API for integrating Noodles.gl geospatial visualizations into your applications.

## Features

- 🎛️ **Toggle Editor Visibility** - Show/hide the node editor on demand
- 🗺️ **Headless Rendering** - Use just the visualization output without the editor
- 📊 **Programmatic Data Input** - Feed data directly into the visualization system
- 🎬 **Unified Rendering** - Synchronize with external multimedia rendering pipelines
- 🎨 **Advanced Controls** - Optionally expose advanced editing capabilities

## Installation

```bash
npm install @noodles-gl/core
# or
yarn add @noodles-gl/core
```

## Quick Start

### Basic Usage (Hidden Editor)

```tsx
import { NoodlesGL } from '@noodles-gl/core';

function App() {
  const noodles = NoodlesGL.create({
    editorVisible: false,  // Hide editor by default
    project: myProjectData  // Load project configuration
  });

  return (
    <div>
      {noodles.render()}
    </div>
  );
}
```

### Toggle Editor Visibility

```tsx
import { NoodlesGL } from '@noodles-gl/core';
import { useState } from 'react';

function App() {
  const [noodles] = useState(() => NoodlesGL.create({ 
    editorVisible: false 
  }));
  const [showEditor, setShowEditor] = useState(false);

  return (
    <div>
      <button onClick={() => {
        setShowEditor(!showEditor);
        noodles.setEditorVisibility(!showEditor);
      }}>
        Toggle Editor
      </button>
      {noodles.render()}
    </div>
  );
}
```

### Programmatic Data Input

```tsx
import { NoodlesGL } from '@noodles-gl/core';

const noodles = NoodlesGL.create();

// Feed data into the visualization
noodles.setData('data-loader', {
  type: 'geojson',
  features: [
    { type: 'Feature', geometry: { type: 'Point', coordinates: [-122, 37] } }
  ]
});

// Listen for rendering events
noodles.on('render', (frame) => {
  console.log('Frame rendered:', frame);
});
```

### Unified Rendering with External Systems

```tsx
import { NoodlesGL } from '@noodles-gl/core';

const noodles = NoodlesGL.create({
  renderMode: 'external',  // Use external rendering context
  onFrame: (canvas, frameData) => {
    // Integrate with your multimedia rendering pipeline
    myVideoRenderer.addFrame(canvas, frameData.timestamp);
  }
});

// Synchronize with timeline
noodles.seekTo(5.0);  // Seek to 5 seconds
noodles.render();     // Render current frame
```

## API Reference

### NoodlesGL.create(options)

Creates a new Noodles.gl instance.

**Options:**
- `editorVisible` (boolean): Show/hide the node editor. Default: `true`
- `project` (NoodlesProject): Project configuration to load
- `renderMode` ('standalone' | 'external'): Rendering mode. Default: `'standalone'`
- `onFrame` (function): Callback for external rendering
- `advancedControls` (boolean): Enable advanced editing features. Default: `false`

### Instance Methods

- `render()` - Returns the React component to render
- `setEditorVisibility(visible: boolean)` - Show/hide the editor
- `loadProject(project: NoodlesProject)` - Load a project
- `setData(operatorId: string, data: unknown)` - Set data for an operator
- `getData(operatorId: string)` - Get output data from an operator
- `seekTo(time: number)` - Seek to a specific time in the timeline
- `play()` / `pause()` - Control timeline playback
- `on(event: string, callback: Function)` - Listen for events
- `off(event: string, callback: Function)` - Remove event listener
- `destroy()` - Clean up resources

### Events

- `render` - Emitted when a frame is rendered
- `data-changed` - Emitted when operator data changes
- `project-loaded` - Emitted when a project is loaded
- `timeline-changed` - Emitted when timeline position changes

## Integration Examples

See the `/examples` directory for complete integration examples:

- **Simple Viewer** - Basic usage with hidden editor
- **Toggle Editor** - Show/hide editor on demand
- **Data Feed** - Programmatic data input
- **Video Export** - Integration with video rendering

## License

MIT
