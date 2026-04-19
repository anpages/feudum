export interface GameMessage {
  id: string
  type: string
  subject: string
  data: Record<string, unknown>
  viewed: boolean
  createdAt: string
}

export interface MessagesResponse {
  messages: GameMessage[]
}
