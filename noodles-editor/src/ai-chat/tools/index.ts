/**
 * AI Tools — generic graph CRUD, date math, activity utils, and chat service.
 *
 * These tools are designed to work with any noodles.gl application.
 * Import from 'noodles-gl-ai/tools' (aliased in consumer vite.config).
 */

export { applyModifications, parseToolCallModifications } from './apply-modifications'
export { createChatService, type ChatService, type ChatServiceConfig } from './chat-service'
export { calculateDateRange, parseRelativeDate, formatDateRangeForAI, type DateRangeResult } from './date-tools'
export { resolveDataRequestTimestamps } from './resolve-timestamps'
export { getActivitiesInfo, formatActivitiesInfoForAI } from './activity-utils'
export type { ActivityData, ActivityInfo, ActivityFilterOptions, ActivitiesInfoResult } from './activity-utils'
export type {
  NoodlesProject, NoodlesNode, NoodlesEdge,
  ProjectModification, ChatMessage, ToolCall,
  ChatResponse, ChatProgressEvent, RateLimitInfo,
  ApplyResult, InjectDataFn,
} from './graph-types'
export { geocodeNominatim, formatNominatimForAI, type NominatimResult } from '../../utils/geocoding-nominatim'
