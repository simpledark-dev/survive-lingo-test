import { NextRequest } from "next/server";
import { getOpenAIService } from "@/services/openai.service";
import type { OpenAIChatRequest, ChatMessage } from "@/services/openai.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context, model = "gpt-3.5-turbo", options } = body;

    if (!message) {
      return new Response(JSON.stringify({ error: "Message is required" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const openaiService = getOpenAIService();

    // Tạo stream response
    const stream = new ReadableStream({
      async start(controller) {
        try {
          let messages;

          if (context) {
            messages = [
              ...(context as ChatMessage[]),
              { role: "user" as const, content: message },
            ];
          } else {
            messages = [{ role: "user" as const, content: message }];
          }

          const chatRequest: OpenAIChatRequest = {
            model,
            messages,
            stream: true,
            ...options,
          };

          // Stream response từ OpenAI
          for await (const chunk of openaiService.streamChat(chatRequest)) {
            const data = JSON.stringify({ content: chunk });
            controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
          }

          controller.enqueue(new TextEncoder().encode("data: [DONE]\n\n"));
          controller.close();
        } catch (error) {
          console.error("Stream Error:", error);
          const errorData = JSON.stringify({
            error: "Stream error",
            message: error instanceof Error ? error.message : "Unknown error",
          });
          controller.enqueue(
            new TextEncoder().encode(`data: ${errorData}\n\n`)
          );
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("API Error:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
