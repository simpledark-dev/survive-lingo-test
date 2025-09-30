import { NextRequest, NextResponse } from "next/server";
import { getConversationService } from "@/services/conversation.service";
import { UpdateConversationRequest } from "@/types/conversation";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationService = getConversationService();
    const conversation = conversationService.getConversation(params.id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error("Get conversation error:", error);
    return NextResponse.json(
      {
        error: "Failed to get conversation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json();
    const updateRequest: UpdateConversationRequest = {
      id: params.id,
      ...body,
    };

    const conversationService = getConversationService();
    const conversation = conversationService.updateConversation(updateRequest);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    console.error("Update conversation error:", error);
    return NextResponse.json(
      {
        error: "Failed to update conversation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const conversationService = getConversationService();
    const deleted = conversationService.deleteConversation(params.id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Conversation not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Conversation deleted successfully",
    });
  } catch (error) {
    console.error("Delete conversation error:", error);
    return NextResponse.json(
      {
        error: "Failed to delete conversation",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
