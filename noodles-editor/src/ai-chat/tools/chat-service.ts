/**
 * Generic Chat Service
 *
 * Configurable multi-turn tool-use chat loop.
 * Platforms provide their own endpoint, auth, prompts, and tool implementations.
 */

import type { ChatMessage, ChatProgressEvent, ChatResponse, ProjectModification } from './graph-types'

export interface ChatServiceConfig {
  endpoint: string
  getAuthHeaders(): Promise<Record<string, string>>
  systemPrompt: string | (() => string)
  tools: unknown[]
  clientToolNames: string[]
  executeClientTool(toolName: string, input: Record<string, unknown>, context: unknown): string | Promise<string>
  maxHistory?: number
  maxIterations?: number
  onProgress?: (event: ChatProgressEvent) => void
}

export interface ChatService {
  sendMessage(message: string, history: ChatMessage[], context: unknown, onProgress?: (event: ChatProgressEvent) => void): Promise<ChatResponse>
}

export function createChatService(config: ChatServiceConfig): ChatService {
  const maxHistory = config.maxHistory ?? 6
  const maxIterations = config.maxIterations ?? 3

  function getSystemPrompt(): string {
    return typeof config.systemPrompt === 'function' ? config.systemPrompt() : config.systemPrompt
  }

  async function callEndpoint(messages: ChatMessage[]) {
    const headers = await config.getAuthHeaders()
    const response = await fetch(config.endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ messages, systemPrompt: getSystemPrompt(), tools: config.tools }),
    })
    if (!response.ok) {
      const errorText = await response.text()
      return { message: 'Sorry, I encountered an error. Please try again.', error: `HTTP ${response.status}: ${errorText}` }
    }
    return response.json() as Promise<{ message: string; toolCalls?: Array<{ name: string; id: string; input: Record<string, unknown> }>; error?: string }>
  }

  async function sendMessage(message: string, conversationHistory: ChatMessage[] = [], context: unknown = {}, onProgress?: (event: ChatProgressEvent) => void): Promise<ChatResponse> {
    const progress = onProgress ?? config.onProgress
    try {
      const messages: ChatMessage[] = [...conversationHistory.slice(-maxHistory), { role: 'user', content: message }]
      let iterations = 0, finalMessage = '', lastAIMessage = ''
      const allModifications: ProjectModification[] = []

      while (iterations < maxIterations) {
        iterations++
        progress?.({ type: 'llm_start', iteration: iterations })
        const result = await callEndpoint(messages)
        if (result.message) lastAIMessage = result.message
        if (result.error) return { message: result.message, error: result.error }

        const clientToolCalls = result.toolCalls?.filter(tc => config.clientToolNames.includes(tc.name))
        const modCalls = result.toolCalls?.filter(tc => tc.name === 'apply_modifications')
        const hasClientTools = clientToolCalls && clientToolCalls.length > 0

        if (modCalls && !hasClientTools) {
          for (const tc of modCalls) {
            if (tc.input?.modifications) {
              const mods = tc.input.modifications as ProjectModification[]
              allModifications.push(...mods)
              progress?.({ type: 'applying_modifications', count: mods.length })
            }
          }
        }

        if (hasClientTools) {
          if (result.message) progress?.({ type: 'llm_message', message: result.message })
          messages.push({ role: 'assistant', content: result.message || '' })
          for (const tc of clientToolCalls) {
            progress?.({ type: 'tool_start', toolName: tc.name })
            const toolResult = await config.executeClientTool(tc.name, tc.input, context)
            progress?.({ type: 'tool_end', toolName: tc.name })
            messages.push({ role: 'user', content: `[Tool Result for ${tc.name}]\n${toolResult}` })
          }
          continue
        }

        finalMessage = result.message || 'Done.'
        break
      }

      return { message: finalMessage || lastAIMessage || 'Done.', modifications: allModifications.length > 0 ? allModifications : undefined }
    } catch (error) {
      return { message: "Sorry, I couldn't connect to the AI service. Please try again.", error: error instanceof Error ? error.message : 'Unknown error' }
    }
  }

  return { sendMessage }
}
