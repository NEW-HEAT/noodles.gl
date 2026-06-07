# Sun Lighting Globe

This example animates deck.gl globe lighting entirely through noodles:

- `MapViewState` drives `DeckRenderer`, `GlobeView`, and `SplitMapViewState`
- `SplitMapViewState.zoom` drives the sunlight-to-directional-light blend
- `SunLightingEffect.effect` feeds `DeckRenderer.effects`
- `TerrainLayer` renders Terrarium elevation tiles with an ArcGIS World Imagery texture
- The timeline keyframes `SunLightingEffect.currentTimeSeconds` through one day
- The timeline also keyframes `MapViewState.latitude` for a gentle globe tilt

The graph intentionally omits bitmap, trip, marker, and EarthSphere layers so
the lighting behavior is isolated on `TerrainLayer`. Terrain detail is raised
with `meshMaxZoom: 8`, `textureMaxZoom: 8`, and `meshMaxError: 1` so the globe
surface stays useful when zooming in.

The graph starts zoomed in enough for `TerrainLayer` tile selection to have
valid Mercator bounds while still using `_SunLight`. Change `/view-state.zoom`
past `2.8` and toward `4` to inspect the transition back to directional lighting.
