# EV Chargers with Static JSON Data

## Overview
This example renders EV charging station data near Denver, CO from a small static JSON payload. It demonstrates a lightweight data pipeline: geocoding a city, calculating the bounding box, and displaying results as either individual points (scatterplot) or a density heatmap. The map automatically centers on the data.

## Key Techniques
- **Geocoder**: `GeocoderOp` with query `"Denver, CO"` converts place name to coordinates
- **JSON source**: `JSONOp` provides lightweight charging station data
- **Bounding box**: `BoundingBoxOp` calculates map extent with 200px padding
- **View state**: `MapViewStateOp` centers map on data at zoom 10.8
- **Position accessor**: `AccessorOp` with expression `[d.lng, d.lat]` extracts coordinates
- **Scatterplot layer**: `ScatterplotLayerOp` shows individual stations
- **Heatmap layer**: `HeatmapLayerOp` shows density with 100px radius
- **Layer switching**: `SwitchOp` toggles between the two visualization styles
- **Basemap**: `MaplibreBasemapOp`

## Data Structure
The JSON source returns records with:
- `lat`, `lng`: Station location
- `name`: Display name

## Node Graph Flow
```
Geocoder → JSON source → BoundingBox → ViewState → Basemap
                               ↘ Position Accessor → Scatterplot Layer → Switch → Deck
                                                   ↘ Heatmap Layer ↗
```

## Use Cases
This pattern is useful for:
- Lightweight data dashboards
- Location-based services
- Infrastructure mapping (charging stations, bike shares, transit)
- Dynamic map applications that respond to user input
- Static and server-backed data visualization
- Geocoding user locations or place names
