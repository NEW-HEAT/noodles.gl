# @noodles-gl/core - Programmatic API Package

## Overview

This package (`@noodles-gl/core`) provides a programmatic interface to Noodles.gl that enables external applications to integrate the visualization system while maintaining control over UI complexity and feature visibility.

## Problem Statement

The request was to create an npm package that allows New Heat (or any other project) to:

1. **Toggle node editor visibility** - Hide the complex node editor by default for simple users
2. **Use the map output** - Embed just the visualization component in their studio
3. **Synchronize rendering** - Integrate Noodles.gl rendering with external multimedia systems
4. **Control feature access** - Hide advanced controls but enable them when needed
5. **Programmatic data input** - Feed data from the application into the visualization

## Solution Architecture

### Package Structure

```
noodles-core/
├── src/
│   ├── noodles-gl.ts              # Main API class
│   ├── noodles-gl-component.tsx   # React component wrapper
│   ├── types.ts                   # TypeScript definitions
│   ├── index.ts                   # Public API exports
│   ├── utils/
│   │   ├── renderer.ts            # External rendering utilities
│   │   └── headless.ts            # Headless visualization
│   └── __tests__/                 # Unit tests
├── examples/                       # Integration examples
│   ├── simple-viewer.tsx          # Basic usage
│   ├── toggle-editor.tsx          # Toggle visibility
│   ├── programmatic-data.tsx      # Data feeding
│   └── external-rendering.tsx     # Multimedia integration
├── README.md                       # Package documentation
├── INTEGRATION.md                  # Integration guide
└── package.json                    # Package configuration
```

### Core API Design

#### NoodlesGL Class

The main API class that manages the visualization instance:

```typescript
const noodles = NoodlesGL.create({
  editorVisible: false,      // Start with editor hidden
  project: myProject,         // Load a project
  advancedControls: false,    // Hide advanced features
  renderMode: 'standalone'    // Or 'external' for video export
});

// Control visibility
noodles.setEditorVisibility(true);

// Feed data programmatically
noodles.setData('/data-loader', myData);

// Control timeline
noodles.seekTo(5.0);
noodles.play();
```

#### Event System

Subscribe to events for reactive integration:

```typescript
noodles.on('render', (frame) => {
  // Called when a frame is rendered
});

noodles.on('data-changed', (change) => {
  // Called when data changes
});
```

#### React Component

Simple React component for rendering:

```tsx
<NoodlesGLComponent 
  instance={noodles}
  project={myProject}
/>
```

### Use Cases

#### 1. Simple Embedded Viewer

For dashboards or presentations where you just want to show a map:

```tsx
function MapViewer({ projectData }) {
  const noodles = NoodlesGL.create({
    editorVisible: false,
    project: projectData
  });

  return <NoodlesGLComponent instance={noodles} />;
}
```

#### 2. Progressive Enhancement

Start simple, enable advanced features on demand:

```tsx
function EnhancedMap() {
  const [showAdvanced, setShowAdvanced] = useState(false);
  const noodles = NoodlesGL.create({ editorVisible: false });

  return (
    <>
      <button onClick={() => {
        setShowAdvanced(!showAdvanced);
        noodles.setEditorVisibility(!showAdvanced);
      }}>
        Toggle Advanced Mode
      </button>
      <NoodlesGLComponent instance={noodles} />
    </>
  );
}
```

#### 3. Programmatic Data Input

Feed data from your application:

```tsx
function DynamicMap() {
  const noodles = NoodlesGL.create({ editorVisible: false });

  useEffect(() => {
    fetchMyData().then(data => {
      noodles.setData('/data-loader', data);
    });
  }, []);

  return <NoodlesGLComponent instance={noodles} />;
}
```

#### 4. Unified Multimedia Export

Integrate with video rendering:

```tsx
const renderer = createVisualizationRenderer({
  width: 1920,
  height: 1080,
  onFrame: (canvas, frameData) => {
    videoEncoder.addFrame(canvas, frameData.timestamp);
  }
});

const noodles = NoodlesGL.create({
  renderMode: 'external',
  onFrame: renderer.captureFrame.bind(renderer)
});

// Render frame-by-frame
for (let t = 0; t < duration; t += 1/fps) {
  noodles.seekTo(t);
  noodles.renderFrame({ timestamp: t, ... });
}
```

## Implementation Status

### ✅ Completed

1. **Package Structure** - Created complete package with proper configuration
2. **Core API** - Implemented `NoodlesGL` class with full API
3. **Type Definitions** - Complete TypeScript types and interfaces
4. **React Component** - `NoodlesGLComponent` wrapper
5. **Utilities** - Renderer and headless visualization utilities
6. **Examples** - Four comprehensive integration examples
7. **Tests** - Unit tests for core functionality
8. **Documentation** - README, integration guide, and API docs

### 🔄 Next Steps (For Full Integration)

The current implementation provides the API structure and patterns. To fully integrate with the existing Noodles.gl codebase:

1. **Link to noodles-editor** - The `NoodlesGLComponent` currently has a placeholder. It needs to:
   - Import and use the actual `getNoodles()` function from noodles-editor
   - Wrap it in a way that respects the `editorVisible` state
   - Pass through the `layoutMode` and `showOverlay` settings

2. **Operator Store Integration** - The `setData()` and `getData()` methods need to:
   - Access the Zustand operator store from noodles-editor
   - Call `setOp()` and `getOp()` functions
   - Handle path resolution correctly

3. **Theatre.js Integration** - Connect the timeline methods to Theatre.js:
   - `seekTo()` should update Theatre.js sheet position
   - `play()` / `pause()` should control Theatre.js playback
   - Events should be emitted from Theatre.js callbacks

4. **Rendering Integration** - For external rendering mode:
   - Capture frames from the Deck.gl canvas
   - Synchronize with Theatre.js timeline
   - Provide canvas access to the renderer

### Integration Approach

The package is designed to be integrated gradually:

**Phase 1: Basic Wrapper (Current)**
- Standalone package with API structure
- Can be used to prototype integrations
- Examples demonstrate the intended patterns

**Phase 2: Core Integration**
- Link `NoodlesGLComponent` to actual noodles-editor components
- Connect to operator store for data methods
- Hook up Theatre.js for timeline control

**Phase 3: Advanced Features**
- External rendering with canvas capture
- Headless mode for server-side rendering
- Advanced event system for reactivity

## Usage for New Heat

Based on the problem statement, here's how New Heat could use this:

```tsx
import { NoodlesGL, NoodlesGLComponent } from '@noodles-gl/core';

function NewHeatStudio() {
  // Create Noodles instance with editor hidden by default
  const [noodles] = useState(() => NoodlesGL.create({
    editorVisible: false,
    advancedControls: false,
    layoutMode: 'output-on-top'
  }));

  // Toggle for power users
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Feed data from New Heat's system
  useEffect(() => {
    noodles.setData('/data-source', myGeojsonData);
  }, [myGeojsonData]);

  // For video export, use external rendering
  const handleExport = async () => {
    const renderer = createVisualizationRenderer({
      onFrame: (canvas, frameData) => {
        // Integrate with New Heat's multimedia renderer
        myRenderer.addMapLayer(canvas, frameData.timestamp);
      }
    });

    // Render timeline
    for (let t = 0; t < duration; t += 1/30) {
      noodles.seekTo(t);
      noodles.renderFrame({ timestamp: t, frameNumber: Math.floor(t * 30), isLastFrame: false });
    }
  };

  return (
    <div className="studio-content">
      {/* Simple UI by default */}
      <button onClick={() => {
        setShowAdvanced(!showAdvanced);
        noodles.setEditorVisibility(!showAdvanced);
      }}>
        {showAdvanced ? 'Simple Mode' : 'Advanced Mode'}
      </button>

      {/* Map visualization */}
      <NoodlesGLComponent instance={noodles} />

      {/* Other multimedia components */}
      <OtherMediaComponents />
    </div>
  );
}
```

## Benefits

1. **Clean Separation** - New Heat's UI stays focused on their experience
2. **Progressive Enhancement** - Start simple, add complexity when needed
3. **Unified Rendering** - Map layers integrate seamlessly with other media
4. **Programmatic Control** - Full control over data and behavior from code
5. **Type Safety** - Complete TypeScript definitions for better DX
6. **Tested** - Unit tests ensure API reliability

## Development

```bash
# Install dependencies
cd noodles-core && yarn install

# Run tests
yarn test

# Build package
yarn build

# Lint
yarn lint
```

## Publishing

Once fully integrated, the package can be published to npm:

```bash
cd noodles-core
npm version patch  # or minor/major
npm publish --access public
```

## Feedback Welcome

This is a foundational implementation designed to support the use case described. The API and patterns can be refined based on actual usage and feedback.

For questions or suggestions, please open an issue on GitHub.
