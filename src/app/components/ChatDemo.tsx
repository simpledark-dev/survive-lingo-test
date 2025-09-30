"use client";

import { useState, useEffect } from "react";
import type { ChatMessage, ChatContext } from "@/services/groq.service";
import type { Conversation } from "@/types/conversation";
import { getClientConversationService } from "@/services/client-conversation.service";

export default function ChatDemo() {
  const [message, setMessage] = useState("");
  const [response, setResponse] = useState("");
  const [loading, setLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAudio, setCurrentAudio] = useState<HTMLAudioElement | null>(
    null
  );
  const [cachedAudioUrl, setCachedAudioUrl] = useState<string | null>(null);
  const [currentConversation, setCurrentConversation] =
    useState<Conversation | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [context, setContext] = useState<ChatContext>({
    messages: [],
    role: "user",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          context,
          model: "llama-3.1-8b-instant",
          options: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        }),
      });

      const data = await res.json();

      if (res.ok) {
        const assistantMessage =
          data.choices[0]?.message?.content || "No response";
        setResponse(assistantMessage);

        // Cập nhật context
        setContext((prev) => ({
          ...prev,
          messages: [
            ...prev.messages,
            { role: "user", content: message },
            { role: "assistant", content: assistantMessage },
          ],
        }));

        // Lưu messages vào conversation nếu có
        if (currentConversation) {
          const conversationService = getClientConversationService();
          conversationService.addMessage(currentConversation.id, {
            role: "user",
            content: message,
          });
          conversationService.addMessage(currentConversation.id, {
            role: "assistant",
            content: assistantMessage,
          });
        }

        // Xóa cache audio khi có response mới
        setCachedAudioUrl(null);
      } else {
        setResponse(`Error: ${data.error || "Unknown error"}`);
      }
    } catch (error) {
      setResponse(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleStreamSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;

    setLoading(true);
    setResponse("");

    try {
      const res = await fetch("/api/chat/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message,
          context,
          model: "llama-3.1-8b-instant",
          options: {
            temperature: 0.7,
            max_tokens: 1000,
          },
        }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        setResponse(`Error: ${errorData.error || "Unknown error"}`);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setResponse("Error: No response stream");
        return;
      }

      let fullResponse = "";
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") {
              // Cập nhật context với response hoàn chỉnh
              setContext((prev) => ({
                ...prev,
                messages: [
                  ...prev.messages,
                  { role: "user", content: message },
                  { role: "assistant", content: fullResponse },
                ],
              }));

              // Lưu messages vào conversation nếu có
              if (currentConversation) {
                const conversationService = getClientConversationService();
                conversationService.addMessage(currentConversation.id, {
                  role: "user",
                  content: message,
                });
                conversationService.addMessage(currentConversation.id, {
                  role: "assistant",
                  content: fullResponse,
                });
              }

              // Xóa cache audio khi có response mới
              setCachedAudioUrl(null);
              return;
            }

            try {
              const parsed = JSON.parse(data);
              if (parsed.content) {
                fullResponse += parsed.content;
                setResponse(fullResponse);
              }
            } catch (e) {
              // Ignore parsing errors for non-JSON data
            }
          }
        }
      }
    } catch (error) {
      setResponse(
        `Error: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    } finally {
      setLoading(false);
    }
  };

  // Load conversations khi component mount
  useEffect(() => {
    loadConversations();
  }, []);

  const loadConversations = () => {
    const conversationService = getClientConversationService();
    const conversations = conversationService.getAllConversations();
    setConversations(conversations);
  };

  const createNewConversation = () => {
    const conversationService = getClientConversationService();
    const conversation = conversationService.createConversation({
      title: "New Conversation",
    });

    setCurrentConversation(conversation);
    setContext({ messages: [], role: "user" });
    setResponse("");
    setCachedAudioUrl(null);
    loadConversations();
  };

  const loadConversation = (conversationId: string) => {
    const conversationService = getClientConversationService();
    const conversation = conversationService.getConversation(conversationId);

    if (conversation) {
      setCurrentConversation(conversation);
      setContext({ messages: conversation.messages, role: "user" });
      setResponse("");
      setCachedAudioUrl(null);
    }
  };

  const deleteConversation = (conversationId: string) => {
    const conversationService = getClientConversationService();
    const deleted = conversationService.deleteConversation(conversationId);

    if (deleted) {
      loadConversations();
      if (currentConversation?.id === conversationId) {
        setCurrentConversation(null);
        setContext({ messages: [], role: "user" });
        setResponse("");
        setCachedAudioUrl(null);
      }
    }
  };

  const clearContext = () => {
    setContext({ messages: [], role: "user" });
    setResponse("");
    setCachedAudioUrl(null); // Xóa cache audio khi clear context
  };

  const handleTextToSpeech = async () => {
    if (!response.trim()) {
      alert("Không có text để phát âm thanh!");
      return;
    }

    try {
      setIsPlaying(true);

      // Dừng audio hiện tại nếu có
      if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
      }

      let audioUrl = cachedAudioUrl;

      // Kiểm tra audio cache trong conversation trước
      if (!audioUrl && currentConversation?.audioCache) {
        const messageId = Object.keys(currentConversation.audioCache).find(
          (id) => currentConversation.audioCache![id].text === response
        );

        if (messageId) {
          audioUrl = currentConversation.audioCache[messageId].audioUrl;
          setCachedAudioUrl(audioUrl);
        }
      }

      // Nếu chưa có cache, tạo mới
      if (!audioUrl) {
        const res = await fetch("/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: response,
            voice: "Fritz-PlayAI",
            model: "playai-tts",
            speed: 1.0,
          }),
        });

        if (!res.ok) {
          const errorData = await res.json();
          alert(`Lỗi TTS: ${errorData.error || "Unknown error"}`);
          return;
        }

        const data = await res.json();
        audioUrl = data.audioUrl.startsWith("/")
          ? `${window.location.origin}${data.audioUrl}`
          : data.audioUrl;

        // Cache audio URL
        setCachedAudioUrl(audioUrl);

        // Lưu audio cache vào conversation nếu có
        if (currentConversation) {
          const conversationService = getClientConversationService();
          const messageId = conversationService.generateMessageId();
          conversationService.addAudioCache(
            currentConversation.id,
            messageId,
            data.audioUrl,
            data.blobName,
            response
          );
        }
      }

      const audio = new Audio(audioUrl!);

      audio.onplay = () => setIsPlaying(true);
      audio.onended = () => setIsPlaying(false);
      audio.onerror = () => {
        setIsPlaying(false);
        alert("Lỗi phát âm thanh!");
      };

      setCurrentAudio(audio);
      await audio.play();
    } catch (error) {
      setIsPlaying(false);
      alert(`Lỗi: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  const stopAudio = () => {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      setIsPlaying(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex gap-6">
        {/* Sidebar cho conversations */}
        <div className="w-80 bg-gray-100 p-4 rounded-lg">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Conversations</h2>
            <button
              onClick={createNewConversation}
              className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
            >
              New
            </button>
          </div>

          <div className="space-y-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-3 rounded cursor-pointer transition-colors ${
                  currentConversation?.id === conv.id
                    ? "bg-blue-200 border-blue-500"
                    : "bg-white hover:bg-gray-50"
                }`}
                onClick={() => loadConversation(conv.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium truncate">{conv.title}</h3>
                    <p className="text-sm text-gray-500">
                      {conv.messages.length} messages
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(conv.updatedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteConversation(conv.id);
                    }}
                    className="text-red-500 hover:text-red-700 text-sm"
                  >
                    ×
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Main chat area */}
        <div className="flex-1">
          <h1 className="text-3xl font-bold mb-6">
            {currentConversation ? currentConversation.title : "Groq Chat Demo"}
          </h1>

          <div className="bg-gray-100 p-4 rounded-lg mb-4">
            <h2 className="text-lg font-semibold mb-2">Context Messages:</h2>
            {context.messages.length === 0 ? (
              <p className="text-gray-500">No messages yet</p>
            ) : (
              <div className="space-y-2">
                {context.messages.map((msg, index) => (
                  <div key={index} className="flex">
                    <span className="font-semibold mr-2 capitalize">
                      {msg.role}:
                    </span>
                    <span>{msg.content}</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={clearContext}
              className="mt-2 px-3 py-1 bg-red-500 text-white rounded hover:bg-red-600"
            >
              Clear Context
            </button>
          </div>

          <form onSubmit={handleSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập tin nhắn của bạn..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
              >
                {loading ? "Đang gửi..." : "Gửi"}
              </button>
            </div>
          </form>

          <form onSubmit={handleStreamSubmit} className="mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Nhập tin nhắn của bạn..."
                className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                disabled={loading}
              />
              <button
                type="submit"
                disabled={loading}
                className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50"
              >
                {loading ? "Đang stream..." : "Stream"}
              </button>
            </div>
          </form>

          {response && (
            <div className="bg-white p-4 border border-gray-300 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold">Response:</h3>
                <div className="flex gap-2">
                  <button
                    onClick={handleTextToSpeech}
                    disabled={isPlaying}
                    className="px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 disabled:opacity-50 flex items-center gap-2"
                  >
                    {isPlaying ? (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Đang phát...
                      </>
                    ) : (
                      <>
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M9.383 3.076A1 1 0 0110 4v12a1 1 0 01-1.617.816L4.383 13H2a1 1 0 01-1-1V8a1 1 0 011-1h2.383l4-4.816A1 1 0 019.383 3.076zM14.657 2.929a1 1 0 011.414 0A9.972 9.972 0 0119 10a9.972 9.972 0 01-2.929 7.071 1 1 0 01-1.414-1.414A7.971 7.971 0 0017 10c0-2.21-.894-4.208-2.343-5.657a1 1 0 010-1.414zm-2.829 2.828a1 1 0 011.415 0A5.983 5.983 0 0115 10a5.984 5.984 0 01-1.757 4.243 1 1 0 01-1.415-1.415A3.984 3.984 0 0013 10a3.983 3.983 0 00-1.172-2.828 1 1 0 010-1.415z"
                            clipRule="evenodd"
                          />
                        </svg>
                        Phát âm thanh
                      </>
                    )}
                  </button>
                  {isPlaying && (
                    <button
                      onClick={stopAudio}
                      className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 flex items-center gap-2"
                    >
                      <svg
                        className="w-4 h-4"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                      >
                        <path
                          fillRule="evenodd"
                          d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1zm4 0a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z"
                          clipRule="evenodd"
                        />
                      </svg>
                      Dừng
                    </button>
                  )}
                </div>
              </div>
              <div className="whitespace-pre-wrap">{response}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
