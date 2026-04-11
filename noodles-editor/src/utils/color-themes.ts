/**
 * Color Theme System — generic palette-based coloring for categorized data.
 *
 * Provides:
 * - Activity/category groupings with configurable color themes
 * - Theme-aware colorization for route/path data
 * - Hex ↔ RGBA conversion helpers
 *
 * Designed to be app-agnostic: consumers define their own themes, groups,
 * and category mappings. Defaults are provided for common activity types.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Category group name (extensible via custom themes) */
export type CategoryGroup = string

/** Color assignment mode */
export type ColorMode =
  | 'category'  // Color by category/group (default)
  | 'theme'     // Use theme's primary color for all
  | 'user'      // Color by user field
  | 'time'      // Color by time (gradient)
  | 'custom'    // Custom color override

/** A color theme with named palette entries */
export interface ColorTheme<G extends string = string> {
  name: string
  primary: string
  palette: Record<G, string>
}

/** Options for colorizing data */
export interface ColorizeOptions<G extends string = string> {
  theme?: string
  colorMode?: ColorMode
  customColor?: string
  opacity?: number
  colorOverrides?: Record<string, string>
  /** Custom themes registry (defaults to built-in ACTIVITY_THEMES) */
  themes?: Record<string, ColorTheme<G>>
  /** Custom category lookup (defaults to built-in ACTIVITY_TO_GROUP) */
  categoryLookup?: Record<string, G>
}

/** Minimal data shape for colorization — must have sourceType, gets color assigned */
export interface ColorableData {
  sourceType?: string
  color?: number[]
  [key: string]: unknown
}

// ---------------------------------------------------------------------------
// Default activity groups and themes
// ---------------------------------------------------------------------------

/** Default activity type groups — similar activities share colors */
export const ACTIVITY_GROUPS: Record<string, readonly string[]> = {
  run: ['Run', 'Running', 'VirtualRun', 'TrailRun', 'TrackRun'],
  hike: ['Hike', 'Hiking', 'Walk', 'Walking', 'Snowshoe', 'Mountaineering'],
  ride: ['Ride', 'Cycling', 'Biking', 'VirtualRide', 'EBikeRide', 'GravelRide', 'MountainBike', 'RoadBike'],
  swim: ['Swim', 'Swimming', 'OpenWaterSwim', 'PoolSwim', 'LapSwim'],
  water: ['Kayaking', 'Canoeing', 'StandUpPaddling', 'Rowing', 'Sail', 'Surfing', 'Kitesurf', 'Windsurf'],
  winter: ['AlpineSki', 'BackcountrySki', 'NordicSki', 'Snowboard', 'IceSkate', 'RollerSki'],
  fitness: ['Workout', 'WeightTraining', 'Crossfit', 'Yoga', 'Elliptical', 'StairStepper'],
  flight: ['Flight', 'Flying', 'Paraglide', 'Hangglide'],
  other: ['Other', 'Golf', 'Soccer', 'RockClimbing', 'Skateboard', 'InlineSkate', 'Wheelchair', 'Handcycle'],
}

/** Reverse lookup: activity type → group (built at module load) */
export const ACTIVITY_TO_GROUP: Record<string, string> = {}
for (const [group, activities] of Object.entries(ACTIVITY_GROUPS)) {
  for (const activity of activities) {
    ACTIVITY_TO_GROUP[activity.toLowerCase().replace(/[_-]/g, '')] = group
  }
}

/** Built-in color themes */
export const ACTIVITY_THEMES: Record<string, ColorTheme> = {
  orange: {
    name: 'New Heat Orange',
    primary: '#F56603',
    palette: {
      run: '#ff4500', hike: '#228b22', ride: '#ffa500', swim: '#40e0d0',
      water: '#00bfff', winter: '#8a2be2', fitness: '#8b0000', flight: '#00ff7f', other: '#FF6B35',
    },
  },
  forest: {
    name: 'Forest Green',
    primary: '#465A35',
    palette: {
      run: '#8B4513', hike: '#228b22', ride: '#6B8E23', swim: '#20B2AA',
      water: '#2E8B57', winter: '#4682B4', fitness: '#556B2F', flight: '#9ACD32', other: '#8FBC8F',
    },
  },
  ocean: {
    name: 'Ocean Blue',
    primary: '#0C5385',
    palette: {
      run: '#4169E1', hike: '#2E8B57', ride: '#1E90FF', swim: '#00CED1',
      water: '#006994', winter: '#87CEEB', fitness: '#4682B4', flight: '#00BFFF', other: '#5F9EA0',
    },
  },
  gold: {
    name: 'Golden Heat',
    primary: '#DD9F49',
    palette: {
      run: '#DAA520', hike: '#BDB76B', ride: '#FFD700', swim: '#40E0D0',
      water: '#5F9EA0', winter: '#B8860B', fitness: '#CD853F', flight: '#F0E68C', other: '#D2691E',
    },
  },
  fire: {
    name: 'Fire Red',
    primary: '#BB2803',
    palette: {
      run: '#FF4500', hike: '#8B4513', ride: '#FF6347', swim: '#FF7F50',
      water: '#E9967A', winter: '#CD5C5C', fitness: '#B22222', flight: '#FF8C00', other: '#DC143C',
    },
  },
  kaylay: {
    name: 'Hot Pink',
    primary: '#FF1493',
    palette: {
      run: '#FF69B4', hike: '#9370DB', ride: '#FF1493', swim: '#DA70D6',
      water: '#BA55D3', winter: '#DDA0DD', fitness: '#C71585', flight: '#EE82EE', other: '#FF00FF',
    },
  },
  mono: {
    name: 'Monochrome',
    primary: '#666666',
    palette: {
      run: '#FF4500', hike: '#228b22', ride: '#ffa500', swim: '#40e0d0',
      water: '#00bfff', winter: '#8a2be2', fitness: '#888888', flight: '#00ff7f', other: '#666666',
    },
  },
}

// ---------------------------------------------------------------------------
// Functions
// ---------------------------------------------------------------------------

/** Get category group for a type string */
export function getCategoryGroup(
  typeStr: string,
  lookup: Record<string, string> = ACTIVITY_TO_GROUP,
): string {
  const normalized = typeStr.toLowerCase().replace(/[_-]/g, '')
  return lookup[normalized] || 'other'
}

/** Get hex color for a type in a given theme */
export function getThemedColor(
  typeStr: string,
  themeName = 'orange',
  themes: Record<string, ColorTheme> = ACTIVITY_THEMES,
  lookup: Record<string, string> = ACTIVITY_TO_GROUP,
): string {
  const group = getCategoryGroup(typeStr, lookup)
  const theme = themes[themeName] || themes[Object.keys(themes)[0]!]!
  return theme.palette[group] || theme.palette.other || theme.primary
}

/** Convert hex to RGBA array */
export function hexToRgbaArray(hex: string, alpha = 255): [number, number, number, number] {
  const clean = hex.replace(/^#/, '')
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return [r, g, b, alpha]
}

/** Apply theme colors to an array of data items */
export function colorizeData<T extends ColorableData>(
  items: T[],
  options: ColorizeOptions = {},
): T[] {
  const {
    theme = 'orange',
    colorMode = 'category',
    customColor = '#ff6432',
    opacity = 255,
    colorOverrides = {},
    themes = ACTIVITY_THEMES,
    categoryLookup = ACTIVITY_TO_GROUP,
  } = options

  const themeData = themes[theme] || themes[Object.keys(themes)[0]!]!

  return items.map((item) => {
    let color: [number, number, number, number]

    const sourceType = item.sourceType || 'Other'
    const override = colorOverrides[sourceType.toLowerCase()]

    if (override) {
      color = hexToRgbaArray(override, opacity)
    } else if (colorMode === 'custom') {
      color = hexToRgbaArray(customColor, opacity)
    } else if (colorMode === 'theme') {
      color = hexToRgbaArray(themeData.primary, opacity)
    } else {
      const hexColor = getThemedColor(sourceType, theme, themes, categoryLookup)
      color = hexToRgbaArray(hexColor, opacity)
    }

    return { ...item, color }
  })
}
