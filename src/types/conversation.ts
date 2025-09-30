import { ChatMessage } from "../services/groq.service";

export interface Conversation {
  id: string;
  title: string;
  messages: ChatMessage[];
  createdAt: Date;
  updatedAt: Date;
  audioCache?: {
    [messageId: string]: {
      audioUrl: string;
      blobName: string;
      text: string;
    };
  };
}

export interface CreateConversationRequest {
  title?: string;
}

export interface UpdateConversationRequest {
  id: string;
  title?: string;
  messages?: ChatMessage[];
}

export interface ConversationListResponse {
  conversations: Conversation[];
  total: number;
}

export interface ConversationResponse {
  conversation: Conversation;
}
