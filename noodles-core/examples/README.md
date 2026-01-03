# Noodles.gl Core API Examples

This directory contains examples demonstrating how to use the `@noodles-gl/core` API to integrate Noodles.gl visualizations into your applications.

## Examples

### 1. Simple Viewer (simple-viewer.tsx)
Basic usage with the editor hidden by default. Shows how to create a minimal visualization viewer.

### 2. Toggle Editor (toggle-editor.tsx)
Demonstrates how to toggle the node editor visibility while maintaining the visualization output.

### 3. Programmatic Data (programmatic-data.tsx)
Shows how to feed data programmatically into the visualization system and listen for changes.

### 4. External Rendering (external-rendering.tsx)
Integration with external multimedia rendering systems for video export.

## Running the Examples

Each example is a standalone React component. You can integrate them into your React application:

```tsx
import { SimpleViewer } from '@noodles-gl/core/examples/simple-viewer';

function App() {
  return <SimpleViewer />;
}
```

Or run them in the demo app (coming soon).
