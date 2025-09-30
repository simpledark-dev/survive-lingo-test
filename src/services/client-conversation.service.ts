import {
  Conversation,
  CreateConversationRequest,
  UpdateConversationRequest,
} from "../types/conversation";
import { ChatMessage } from "./groq.service";

class ClientConversationService {
  private conversations: Map<string, Conversation> = new Map();
  private readonly STORAGE_KEY = "groq_conversations";

  constructor() {
    this.loadFromStorage();
  }

  /**
   * Load conversations từ localStorage
   */
  private loadFromStorage(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const conversationsArray = JSON.parse(stored);
        this.conversations = new Map(conversationsArray);
        console.log(
          `Loaded ${this.conversations.size} conversations from localStorage`
        );
      }
    } catch (error) {
      console.error("Failed to load conversations from localStorage:", error);
    }
  }

  /**
   * Save conversations vào localStorage
   */
  private saveToStorage(): void {
    try {
      const conversationsArray = Array.from(this.conversations.entries());
      localStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(conversationsArray)
      );
      console.log(
        `Saved ${this.conversations.size} conversations to localStorage`
      );
    } catch (error) {
      console.error("Failed to save conversations to localStorage:", error);
    }
  }

  /**
   * Tạo conversation mới
   */
  createConversation(request: CreateConversationRequest): Conversation {
    const id = `conv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const conversation: Conversation = {
      id,
      title: request.title || `Conversation ${this.conversations.size + 1}`,
      messages: [],
      createdAt: now,
      updatedAt: now,
      audioCache: {},
    };

    this.conversations.set(id, conversation);
    this.saveToStorage();
    console.log(`Created conversation: ${id}`);

    return conversation;
  }

  /**
   * Lấy conversation theo ID
   */
  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) || null;
  }

  /**
   * Lấy danh sách tất cả conversations
   */
  getAllConversations(): Conversation[] {
    return Array.from(this.conversations.values()).sort(
      (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
    );
  }

  /**
   * Cập nhật conversation
   */
  updateConversation(request: UpdateConversationRequest): Conversation | null {
    const conversation = this.conversations.get(request.id);
    if (!conversation) {
      return null;
    }

    if (request.title !== undefined) {
      conversation.title = request.title;
    }

    if (request.messages !== undefined) {
      conversation.messages = request.messages;
    }

    conversation.updatedAt = new Date();
    this.conversations.set(request.id, conversation);
    this.saveToStorage();

    console.log(`Updated conversation: ${request.id}`);
    return conversation;
  }

  /**
   * Thêm message vào conversation
   */
  addMessage(
    conversationId: string,
    message: ChatMessage
  ): Conversation | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    conversation.messages.push(message);
    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
    this.saveToStorage();

    console.log(`Added message to conversation: ${conversationId}`);
    return conversation;
  }

  /**
   * Thêm audio cache vào conversation
   */
  addAudioCache(
    conversationId: string,
    messageId: string,
    audioUrl: string,
    blobName: string,
    text: string
  ): Conversation | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation) {
      return null;
    }

    if (!conversation.audioCache) {
      conversation.audioCache = {};
    }

    conversation.audioCache[messageId] = {
      audioUrl,
      blobName,
      text,
    };

    conversation.updatedAt = new Date();
    this.conversations.set(conversationId, conversation);
    this.saveToStorage();

    console.log(`Added audio cache to conversation: ${conversationId}`);
    return conversation;
  }

  /**
   * Lấy audio cache từ conversation
   */
  getAudioCache(
    conversationId: string,
    messageId: string
  ): {
    audioUrl: string;
    blobName: string;
    text: string;
  } | null {
    const conversation = this.conversations.get(conversationId);
    if (!conversation || !conversation.audioCache) {
      return null;
    }

    return conversation.audioCache[messageId] || null;
  }

  /**
   * Xóa conversation
   */
  deleteConversation(id: string): boolean {
    const deleted = this.conversations.delete(id);
    if (deleted) {
      this.saveToStorage();
      console.log(`Deleted conversation: ${id}`);
    }
    return deleted;
  }

  /**
   * Tạo message ID unique
   */
  generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

// Export singleton instance
let clientConversationServiceInstance: ClientConversationService | null = null;

export function getClientConversationService(): ClientConversationService {
  if (!clientConversationServiceInstance) {
    clientConversationServiceInstance = new ClientConversationService();
  }
  return clientConversationServiceInstance;
}

export default ClientConversationService;
