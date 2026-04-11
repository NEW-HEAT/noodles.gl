/**
 * Nominatim (OpenStreetMap) geocoding — free, no API key, 1 req/sec rate limit.
 *
 * Lightweight alternative to the Google/Mapbox geocoders for simple lookups.
 */

export interface NominatimResult {
  latitude: number
  longitude: number
  displayName: string
  /** [south, north, west, east] */
  boundingBox?: [number, number, number, number]
}

/** Geocode a location name to coordinates via Nominatim */
export async function geocodeNominatim(
  location: string,
  userAgent = 'noodles.gl/1.0',
): Promise<NominatimResult> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`

  const response = await fetch(url, {
    headers: { 'User-Agent': userAgent },
  })

  if (!response.ok) {
    throw new Error(`Geocoding failed: HTTP ${response.status}`)
  }

  const data = (await response.json()) as Array<{
    lat: string
    lon: string
    display_name: string
    boundingbox?: [string, string, string, string]
  }>

  const first = data[0]
  if (!first) {
    throw new Error(`Could not find location: ${location}`)
  }

  return {
    latitude: Number(first.lat),
    longitude: Number(first.lon),
    displayName: first.display_name,
    boundingBox: first.boundingbox
      ? [Number(first.boundingbox[0]), Number(first.boundingbox[1]), Number(first.boundingbox[2]), Number(first.boundingbox[3])]
      : undefined,
  }
}

/** Format geocode result as a string for LLM context */
export function formatNominatimForAI(result: NominatimResult): string {
  return `Location: ${result.displayName}\nLatitude: ${result.latitude.toFixed(4)}\nLongitude: ${result.longitude.toFixed(4)}\nUse these coordinates with /view-state to navigate there.`
}
