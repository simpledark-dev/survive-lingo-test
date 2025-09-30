import Groq from "groq-sdk";
import { getAzureStorageService } from "./azure-storage.service";

// Types cho Groq service
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatContext {
  messages: ChatMessage[];
  role: string;
}

export interface GroqChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface GroqChatResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: ChatMessage;
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface GroqServiceConfig {
  apiKey: string;
  baseURL?: string;
}

export interface GroqTTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
  speed?: number;
}

export interface GroqTTSResponse {
  audio: Blob;
  url: string;
  blobName: string;
}

class GroqService {
  private client: Groq;
  private config: GroqServiceConfig;

  constructor(config: GroqServiceConfig) {
    this.config = config;
    this.client = new Groq({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  /**
   * Gửi chat request đến Groq API
   */
  async chat(request: GroqChatRequest): Promise<GroqChatResponse> {
    try {
      const response = await this.client.chat.completions.create({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature || 0.7,
        max_tokens: request.max_tokens || 1000,
        top_p: request.top_p || 1,
        stream: request.stream || false,
        stop: request.stop,
      });

      return response as GroqChatResponse;
    } catch (error) {
      console.error("Groq API Error:", error);
      throw new Error(
        `Groq API Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Tạo conversation với context
   */
  async chatWithContext(
    message: string,
    context: ChatMessage[],
    model: string = "llama-3.1-8b-instant",
    options?: Partial<GroqChatRequest>
  ): Promise<GroqChatResponse> {
    const messages: ChatMessage[] = [
      ...context,
      { role: "user", content: message },
    ];

    return this.chat({
      model,
      messages,
      ...options,
    });
  }

  /**
   * Stream chat response
   */
  async *streamChat(
    request: GroqChatRequest
  ): AsyncGenerator<string, void, unknown> {
    try {
      const stream = await this.client.chat.completions.create({
        ...request,
        stream: true,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content;
        if (content) {
          yield content;
        }
      }
    } catch (error) {
      console.error("Groq Stream Error:", error);
      throw new Error(
        `Groq Stream Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Lấy danh sách models có sẵn
   */
  async getModels() {
    try {
      const response = await this.client.models.list();
      return response.data;
    } catch (error) {
      console.error("Groq Models Error:", error);
      throw new Error(
        `Groq Models Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Text-to-Speech: Chuyển đổi text thành audio
   */
  async textToSpeech(request: GroqTTSRequest): Promise<GroqTTSResponse> {
    try {
      console.log("TTS Request:", {
        model: request.model,
        input: request.input,
        voice: request.voice,
        response_format: request.response_format || "wav",
        speed: request.speed || 1.0,
      });

      const response = await this.client.audio.speech.create({
        model: request.model,
        voice: request.voice,
        input: request.input,
        response_format: (request.response_format || "wav") as
          | "wav"
          | "flac"
          | "mp3"
          | "mulaw"
          | "ogg",
      });

      const audioBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });

      // Tạo ID unique cho audio file
      const timestamp = Date.now();
      const audioId = `tts_${timestamp}`;

      // Upload lên Azure Storage
      const azureStorage = getAzureStorageService();
      const uploadResult = await azureStorage.uploadAudioFromBuffer({
        id: audioId,
        buffer: Buffer.from(audioBuffer),
        contentType: "audio/wav",
      });

      return {
        audio: audioBlob,
        url: uploadResult.url,
        blobName: uploadResult.blobName,
      };
    } catch (error) {
      console.error("Groq TTS Error:", error);
      throw new Error(
        `Groq TTS Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * TTS với cấu hình mặc định
   */
  async speakText(
    text: string,
    voice: string = "Fritz-PlayAI",
    model: string = "playai-tts"
  ): Promise<GroqTTSResponse> {
    return this.textToSpeech({
      model,
      input: text,
      voice,
      response_format: "wav",
      speed: 1.0,
    });
  }
}

// Export singleton instance
let groqServiceInstance: GroqService | null = null;

export function getGroqService(): GroqService {
  if (!groqServiceInstance) {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      throw new Error("GROQ_API_KEY environment variable is required");
    }
    groqServiceInstance = new GroqService({ apiKey });
  }
  return groqServiceInstance;
}

export default GroqService;
