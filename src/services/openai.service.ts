import OpenAI from "openai";
import { getAzureStorageService } from "./azure-storage.service";

// Types cho OpenAI service
export interface ChatMessage {
  role: "user" | "assistant" | "system";
  content: string;
}

export interface ChatContext {
  messages: ChatMessage[];
  role: string;
}

export interface OpenAIChatRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  stream?: boolean;
  stop?: string | string[];
}

export interface OpenAIChatResponse {
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

export interface OpenAIServiceConfig {
  apiKey: string;
  baseURL?: string;
}

export interface OpenAITTSRequest {
  model: string;
  input: string;
  voice: string;
  response_format?: string;
  speed?: number;
}

export interface OpenAITTSResponse {
  audio: Blob;
  url: string;
  blobName: string;
}

class OpenAIService {
  private client: OpenAI;
  private config: OpenAIServiceConfig;

  constructor(config: OpenAIServiceConfig) {
    this.config = config;
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseURL,
    });
  }

  /**
   * Gửi chat request đến OpenAI API
   */
  async chat(request: OpenAIChatRequest): Promise<OpenAIChatResponse> {
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

      return response as OpenAIChatResponse;
    } catch (error) {
      console.error("OpenAI API Error:", error);
      throw new Error(
        `OpenAI API Error: ${
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
    context: ChatContext,
    model: string = "gpt-3.5-turbo",
    options?: Partial<OpenAIChatRequest>
  ): Promise<OpenAIChatResponse> {
    const messages: ChatMessage[] = [
      ...context.messages,
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
    request: OpenAIChatRequest
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
      console.error("OpenAI Stream Error:", error);
      throw new Error(
        `OpenAI Stream Error: ${
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
      console.error("OpenAI Models Error:", error);
      throw new Error(
        `OpenAI Models Error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  /**
   * Text-to-Speech: Chuyển đổi text thành audio
   */
  async textToSpeech(request: OpenAITTSRequest): Promise<OpenAITTSResponse> {
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
        voice: request.voice as
          | "alloy"
          | "echo"
          | "fable"
          | "onyx"
          | "nova"
          | "shimmer",
        input: request.input,
        response_format: (request.response_format || "wav") as
          | "wav"
          | "flac"
          | "mp3"
          | "opus"
          | "aac"
          | "pcm",
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
      console.error("OpenAI TTS Error:", error);
      throw new Error(
        `OpenAI TTS Error: ${
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
    voice: string = "alloy",
    model: string = "tts-1"
  ): Promise<OpenAITTSResponse> {
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
let openaiServiceInstance: OpenAIService | null = null;

export function getOpenAIService(): OpenAIService {
  if (!openaiServiceInstance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OPENAI_API_KEY environment variable is required");
    }
    openaiServiceInstance = new OpenAIService({ apiKey });
  }
  return openaiServiceInstance;
}

export default OpenAIService;
