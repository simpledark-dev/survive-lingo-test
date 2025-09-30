import { NextRequest, NextResponse } from "next/server";
import { getOpenAIService } from "@/services/openai.service";
import type { OpenAIChatRequest, ChatContext } from "@/services/openai.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, context, model = "gpt-3.5-turbo", options } = body;

    if (!message) {
      return NextResponse.json(
        { error: "Message is required" },
        { status: 400 }
      );
    }

    const openaiService = getOpenAIService();

    // Nếu có context, sử dụng chatWithContext
    if (context) {
      const response = await openaiService.chatWithContext(
        message,
        context as ChatContext,
        model,
        options
      );
      return NextResponse.json(response);
    }

    // Nếu không có context, tạo request đơn giản
    const chatRequest: OpenAIChatRequest = {
      model,
      messages: [{ role: "user", content: message }],
      ...options,
    };

    const response = await openaiService.chat(chatRequest);
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
    const openaiService = getOpenAIService();
    const models = await openaiService.getModels();
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
