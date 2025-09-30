# Groq API Integration - Hướng dẫn sử dụng

## Tổng quan

Dự án này tích hợp Groq API để cung cấp các tính năng chat AI với các model như Llama. API được thiết kế với TypeScript và Next.js 15.

## Cấu trúc API

### 1. Groq Service (`/src/services/groq.service.ts`)

Service chính để tương tác với Groq API:

```typescript
import { getGroqService } from "@/services/groq.service";

const groqService = getGroqService();
```

**Các interface chính:**

- `ChatMessage`: Định nghĩa cấu trúc tin nhắn
- `ChatContext`: Context cho conversation
- `GroqChatRequest`: Request format
- `GroqChatResponse`: Response format

### 2. API Endpoints

#### `/api/chat` (POST)

Gửi chat request thông thường:

```typescript
// Request body
{
  "message": "Xin chào, bạn có thể giúp tôi không?",
  "context": {
    "messages": [
      { "role": "user", "content": "Tin nhắn trước đó" },
      { "role": "assistant", "content": "Phản hồi trước đó" }
    ],
    "role": "user"
  },
  "model": "llama-3.1-8b-instant",
  "options": {
    "temperature": 0.7,
    "max_tokens": 1000
  }
}
```

#### `/api/chat/stream` (POST)

Gửi chat request với streaming response:

```typescript
// Request body (giống như /api/chat)
// Response: Server-Sent Events (SSE)
```

#### `/api/chat` (GET)

Lấy danh sách models có sẵn:

```typescript
// Response
{
  "models": [
    {
      "id": "llama-3.1-8b-instant",
      "object": "model",
      "created": 1234567890,
      "owned_by": "groq"
    }
  ]
}
```

#### `/api/tts` (POST)

Chuyển đổi text thành âm thanh:

```typescript
// Request body
{
  "text": "Xin chào, đây là text cần chuyển thành âm thanh",
  "voice": "Fritz-PlayAI",
  "model": "playai-tts",
  "speed": 1.0
}

// Response
{
  "audioUrl": "blob:http://localhost:3000/...",
  "voice": "Fritz-PlayAI",
  "model": "playai-tts"
}
```

## Cách sử dụng

### 1. Cài đặt Environment Variables

Tạo file `.env.local`:

```env
GROQ_API_KEY=your_groq_api_key_here
```

### 2. Sử dụng API từ Frontend

```typescript
// Chat thông thường
const response = await fetch("/api/chat", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Xin chào!",
    model: "llama-3.1-8b-instant",
  }),
});

const data = await response.json();
console.log(data.choices[0].message.content);
```

```typescript
// Text-to-Speech
const ttsResponse = await fetch("/api/tts", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    text: "Xin chào, đây là âm thanh từ AI!",
    voice: "Fritz-PlayAI",
    model: "playai-tts",
    speed: 1.0,
  }),
});

const ttsData = await ttsResponse.json();
const audio = new Audio(ttsData.audioUrl);
audio.play();
```

```typescript
// Chat với streaming
const response = await fetch("/api/chat/stream", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    message: "Kể tôi nghe một câu chuyện",
    model: "llama-3.1-8b-instant",
  }),
});

const reader = response.body?.getReader();
const decoder = new TextDecoder();

while (true) {
  const { done, value } = await reader.read();
  if (done) break;

  const chunk = decoder.decode(value);
  const lines = chunk.split("\n");

  for (const line of lines) {
    if (line.startsWith("data: ")) {
      const data = line.slice(6);
      if (data === "[DONE]") break;

      try {
        const parsed = JSON.parse(data);
        console.log(parsed.content);
      } catch (e) {
        // Ignore parsing errors
      }
    }
  }
}
```

### 3. Sử dụng trực tiếp Groq Service

```typescript
import { getGroqService } from "@/services/groq.service";

const groqService = getGroqService();

// Chat đơn giản
const response = await groqService.chat({
  model: "llama-3.1-8b-instant",
  messages: [{ role: "user", content: "Xin chào!" }],
});

// Chat với context
const response = await groqService.chatWithContext(
  "Tiếp tục câu chuyện",
  {
    messages: [
      { role: "user", content: "Kể tôi nghe về AI" },
      { role: "assistant", content: "AI là..." },
    ],
    role: "user",
  },
  "llama-3.1-8b-instant"
);

// Streaming
for await (const chunk of groqService.streamChat({
  model: "llama-3.1-8b-instant",
  messages: [{ role: "user", content: "Xin chào!" }],
})) {
  console.log(chunk);
}

// Text-to-Speech
const ttsResponse = await groqService.speakText(
  "Xin chào, đây là âm thanh từ AI!",
  "Fritz-PlayAI",
  "playai-tts"
);

const audio = new Audio(ttsResponse.url);
audio.play();
```

## Demo Component

Dự án bao gồm một component demo (`/src/app/components/ChatDemo.tsx`) để test các tính năng:

- Chat thông thường
- Chat với streaming
- Text-to-Speech với nút phát âm thanh
- Quản lý context
- Giao diện đơn giản

## Models có sẵn

- `llama-3.1-8b-instant` (mặc định)
- `llama-3.1-70b-versatile`
- `llama-3.1-70b-chat`
- `mixtral-8x7b-32768`

## Error Handling

API trả về các lỗi phổ biến:

- `400`: Message is required
- `500`: Internal server error
- `GROQ_API_KEY` không được cấu hình

## Chạy dự án

```bash
# Cài đặt dependencies
npm install

# Chạy development server
npm run dev

# Build production
npm run build
npm start
```

Truy cập `http://localhost:3000` để xem demo.
