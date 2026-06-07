# Sun Lighting Globe

This example animates deck.gl globe lighting entirely through noodles:

- `MapViewState` drives `DeckRenderer`, `MapView`, and `SplitMapViewState`
- `SplitMapViewState.zoom` drives the sunlight-to-directional-light blend
- `SunLightingEffect.effect` feeds `DeckRenderer.effects`
- `TerrainLayer` renders Terrarium elevation tiles with an ArcGIS World Imagery texture
- The timeline keyframes `SunLightingEffect.currentTimeSeconds` through one day
- The timeline also keyframes `MapViewState.latitude` for a gentle globe tilt

The graph intentionally omits bitmap, trip, marker, and EarthSphere layers so
the lighting behavior is isolated on `TerrainLayer`. It uses `MapView` for this
pass because deck.gl's tiled `TerrainLayer` creates an internal `TileLayer`, and
that tile-selection path currently asserts under `GlobeView` in this low-level
noodles demo. Terrain detail is raised with `meshMaxZoom: 8`, `textureMaxZoom: 8`,
and `meshMaxError: 1`.

The graph starts over Mt. St. Helens at terrain scale while still using `_SunLight`.
Change `/view-state.zoom` past `12` and toward `13` to inspect the transition back
to directional lighting.
