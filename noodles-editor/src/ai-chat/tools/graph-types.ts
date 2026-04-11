/**
 * Types for noodles graph manipulation via LLM.
 *
 * Generic types shared across chat service, apply-modifications, and tools.
 */

/** Noodles project structure */
export interface NoodlesProject {
  version?: number
  nodes?: NoodlesNode[]
  edges?: NoodlesEdge[]
}

export interface NoodlesNode {
  id: string
  type: string
  position?: { x: number; y: number }
  data?: Record<string, unknown>
}

export interface NoodlesEdge {
  id: string
  source: string
  target: string
  sourceHandle?: string
  targetHandle?: string
}

/** Project modification types — full CRUD for nodes and edges */
export type ProjectModification =
  | { type: 'add_node'; data: NoodlesNode }
  | { type: 'update_node'; data: Partial<NoodlesNode> & { id: string } }
  | { type: 'delete_node'; data: { id: string } }
  | { type: 'add_edge'; data: NoodlesEdge }
  | { type: 'delete_edge'; data: { id: string } }

/** Chat message */
export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

/** Tool call from AI */
export interface ToolCall {
  name: string
  id?: string
  input: Record<string, unknown>
}

/** Rate limit info */
export interface RateLimitInfo {
  remaining: number
  limit: number
  tier: string
}

/** Response from the chat service */
export interface ChatResponse {
  message: string
  modifications?: ProjectModification[]
  toolCalls?: ToolCall[]
  error?: string
  rateLimit?: RateLimitInfo
  applyResult?: ApplyResult
}

/** Result of applying modifications */
export interface ApplyResult {
  success: boolean
  appliedCount: number
  errors: string[]
  warnings?: string[]
}

/** Injection function type */
export type InjectDataFn = (
  nodeId: string,
  inputKey: string,
  value: unknown,
) => { success: boolean; error?: string }

/** Progress events during tool-use loop */
export type ChatProgressEvent =
  | { type: 'llm_start'; iteration: number }
  | { type: 'llm_message'; message: string }
  | { type: 'tool_start'; toolName: string }
  | { type: 'tool_end'; toolName: string }
  | { type: 'applying_modifications'; count: number }
