import { NextRequest, NextResponse } from "next/server";
import { getConversationService } from "@/services/conversation.service";
import { ChatMessage } from "@/services/groq.service";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message, audioUrl, blobName, text } = body;

    const conversationService = getConversationService();

    // Thêm message vào conversation
    if (message) {
      const updatedConversation = conversationService.addMessage(
        id,
        message
      );
      if (!updatedConversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }
    }

    // Thêm audio cache nếu có
    if (audioUrl && blobName && text) {
      const messageId = conversationService.generateMessageId();
      const updatedConversation = conversationService.addAudioCache(
        id,
        messageId,
        audioUrl,
        blobName,
        text
      );

      if (!updatedConversation) {
        return NextResponse.json(
          { error: "Conversation not found" },
          { status: 404 }
        );
      }

      return NextResponse.json({
        conversation: updatedConversation,
        messageId,
      });
    }

    const conversation = conversationService.getConversation(id);
    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error("Add message error:", error);
    return NextResponse.json(
      {
        error: "Failed to add message",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
