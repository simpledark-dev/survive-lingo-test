import { NextRequest, NextResponse } from "next/server";
import { getConversationService } from "@/services/conversation.service";
import { CreateConversationRequest } from "@/types/conversation";

export async function GET() {
  try {
    const conversationService = getConversationService();
    const conversations = conversationService.getAllConversations();

    return NextResponse.json({
      conversations,
      total: conversations.length,
    });
  } catch (error) {
    console.error("Get conversations error:", error);
    return NextResponse.json(
      {
        error: "Failed to get conversations",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title } = body as CreateConversationRequest;

    const conversationService = getConversationService();
    const conversation = conversationService.createConversation({ title });

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json(
      {
        error: "Failed to create conversation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
