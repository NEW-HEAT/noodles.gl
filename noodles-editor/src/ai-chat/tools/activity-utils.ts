/**
 * Activity Utilities for AI Tool Handling
 *
 * Pure functions for querying/filtering activity data and formatting for AI context.
 */

export interface ActivityData {
  id: string
  path: [number, number][]
  timestamps?: number[]
  color?: number[]
  activityType?: string
  sourceType?: string
}

export interface ActivityInfo {
  id: string
  activityType: string
  startTime: Date | null
  endTime: Date | null
  durationMs: number | null
  bounds: [[number, number], [number, number]] | null
  center: [number, number] | null
  pathLength: number
}

export interface ActivityFilterOptions {
  filter?: 'today' | 'recent' | 'longest' | 'all'
  activityType?: string
  limit?: number
}

export interface ActivitiesInfoResult {
  activities: ActivityInfo[]
  totalCount: number
  suggestedViewState?: { longitude: number; latitude: number; zoom: number }
}

function getBoundsFromPath(path: [number, number][]): [[number, number], [number, number]] | null {
  if (!path || path.length === 0) return null
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const [lng, lat] of path) {
    if (lng < minLng) minLng = lng; if (lng > maxLng) maxLng = lng
    if (lat < minLat) minLat = lat; if (lat > maxLat) maxLat = lat
  }
  return [[minLng, minLat], [maxLng, maxLat]]
}

function getCenterFromBounds(bounds: [[number, number], [number, number]]): [number, number] {
  return [(bounds[0][0] + bounds[1][0]) / 2, (bounds[0][1] + bounds[1][1]) / 2]
}

function getZoomForBounds(bounds: [[number, number], [number, number]]): number {
  const maxDiff = Math.max(Math.abs(bounds[1][0] - bounds[0][0]), Math.abs(bounds[1][1] - bounds[0][1]))
  if (maxDiff > 100) return 2; if (maxDiff > 50) return 3; if (maxDiff > 20) return 4
  if (maxDiff > 10) return 5; if (maxDiff > 5) return 6; if (maxDiff > 2) return 7
  if (maxDiff > 1) return 8; if (maxDiff > 0.5) return 9; if (maxDiff > 0.2) return 10
  if (maxDiff > 0.1) return 11; if (maxDiff > 0.05) return 12; if (maxDiff > 0.02) return 13
  return 14
}

function activityToInfo(activity: ActivityData): ActivityInfo {
  const bounds = getBoundsFromPath(activity.path)
  const center = bounds ? getCenterFromBounds(bounds) : null
  let startTime: Date | null = null, endTime: Date | null = null, durationMs: number | null = null
  if (activity.timestamps && activity.timestamps.length > 0) {
    startTime = new Date(activity.timestamps[0]!)
    endTime = new Date(activity.timestamps[activity.timestamps.length - 1]!)
    durationMs = endTime.getTime() - startTime.getTime()
  }
  return { id: activity.id, activityType: activity.activityType || activity.sourceType || 'Unknown', startTime, endTime, durationMs, bounds, center, pathLength: activity.path.length }
}

function filterByTime(activities: ActivityInfo[], timeFilter: 'today' | 'recent' | 'longest' | 'all'): ActivityInfo[] {
  const now = new Date()
  switch (timeFilter) {
    case 'today': { const s = new Date(now); s.setHours(0, 0, 0, 0); return activities.filter(a => a.startTime && a.startTime >= s) }
    case 'recent': { const w = new Date(now.getTime() - 604800000); return activities.filter(a => a.startTime && a.startTime >= w) }
    case 'longest': return [...activities].sort((a, b) => (a.durationMs && b.durationMs) ? b.durationMs - a.durationMs : b.pathLength - a.pathLength)
    default: return activities
  }
}

function getCombinedBounds(activities: ActivityInfo[]): [[number, number], [number, number]] | null {
  if (activities.length === 0) return null
  let minLng = Infinity, maxLng = -Infinity, minLat = Infinity, maxLat = -Infinity
  for (const a of activities) {
    if (a.bounds) {
      if (a.bounds[0][0] < minLng) minLng = a.bounds[0][0]; if (a.bounds[1][0] > maxLng) maxLng = a.bounds[1][0]
      if (a.bounds[0][1] < minLat) minLat = a.bounds[0][1]; if (a.bounds[1][1] > maxLat) maxLat = a.bounds[1][1]
    }
  }
  return minLng === Infinity ? null : [[minLng, minLat], [maxLng, maxLat]]
}

/** Process activities and return filtered info for the AI */
export function getActivitiesInfo(activities: ActivityData[], options: ActivityFilterOptions = {}): ActivitiesInfoResult {
  const { filter = 'all', activityType = 'any', limit = 5 } = options
  let infos = activities.map(activityToInfo)
  if (activityType && activityType !== 'any') infos = infos.filter(a => a.activityType.toLowerCase() === activityType.toLowerCase())
  infos = filterByTime(infos, filter)
  const totalCount = infos.length
  const limited = infos.slice(0, limit)
  let suggestedViewState: ActivitiesInfoResult['suggestedViewState']
  if (limited.length > 0) {
    const bounds = getCombinedBounds(limited)
    if (bounds) {
      const center = getCenterFromBounds(bounds)
      suggestedViewState = { longitude: center[0], latitude: center[1], zoom: Math.min(getZoomForBounds(bounds) + 1, 16) }
    }
  }
  return { activities: limited, totalCount, suggestedViewState }
}

/** Format activities info as a string for the AI response */
export function formatActivitiesInfoForAI(result: ActivitiesInfoResult): string {
  if (result.activities.length === 0) return 'No activities found matching your criteria.'
  const lines: string[] = [`Found ${result.totalCount} activities:`]
  for (const a of result.activities) {
    const parts: string[] = [`- ${a.activityType}`]
    if (a.startTime) parts.push(`on ${a.startTime.toLocaleDateString()}`)
    if (a.durationMs) {
      const mins = Math.round(a.durationMs / 60000)
      parts.push(mins >= 60 ? `(${Math.floor(mins / 60)}h ${mins % 60}m)` : `(${mins}m)`)
    }
    if (a.center) parts.push(`near [${a.center[0].toFixed(2)}, ${a.center[1].toFixed(2)}]`)
    lines.push(parts.join(' '))
  }
  if (result.suggestedViewState) {
    lines.push('', `Suggested view: longitude=${result.suggestedViewState.longitude.toFixed(4)}, latitude=${result.suggestedViewState.latitude.toFixed(4)}, zoom=${result.suggestedViewState.zoom}`)
  }
  return lines.join('\n')
}
