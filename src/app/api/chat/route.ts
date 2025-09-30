import { NextRequest, NextResponse } from "next/server";
import { getGroqService } from "@/services/groq.service";
import type { GroqChatRequest, ChatContext } from "@/services/groq.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context, model = "llama-3.1-8b-instant", options } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const groqService = getGroqService();

    // Nếu có context, sử dụng chatWithContext
    if (context) {
      const response = await groqService.chatWithContext(
        message,
        context as ChatContext,
        model,
        options
      );
      return NextResponse.json(response);
    }

    // Nếu không có context, tạo request đơn giản
    const chatRequest: GroqChatRequest = {
      model,
      messages: [{ role: "user", content: message }],
      ...options,
    };

    const response = await groqService.chat(chatRequest);
    return NextResponse.json(response);
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const groqService = getGroqService();
    const models = await groqService.getModels();
    return NextResponse.json({ models });
  } catch (error) {
    console.error("API Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch models",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
