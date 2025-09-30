import { NextRequest, NextResponse } from "next/server";
import { getOpenAIService } from "@/services/openai.service";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { text, voice = "alloy", model = "tts-1", speed = 1.0 } = body;

    if (!text) {
      return NextResponse.json({ error: "Text is required" }, { status: 400 });
    }

    const openaiService = getOpenAIService();
    const ttsResponse = await openaiService.speakText(text, voice, model);

    // Trả về audio URL từ Azure Storage
    return NextResponse.json({
      audioUrl: ttsResponse.url,
      blobName: ttsResponse.blobName,
      voice,
      model,
    });
  } catch (error) {
    console.error("TTS API Error:", error);
    return NextResponse.json(
      {
        error: "TTS generation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
