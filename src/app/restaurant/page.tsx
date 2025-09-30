"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import type { ChatMessage } from "@/services/openai.service";

// Customer states
enum CustomerState {
  WAITING_OUTSIDE = "waiting_outside",
  CONFIRM_SEATING = "confirm_seating",
  SEATED_IDLE = "seated_idle",
  REQUEST_MENU = "request_menu",
  ORDERING = "ordering",
  KITCHEN_PENDING = "kitchen_pending",
  KITCHEN_READY = "kitchen_ready",
  SERVING = "serving",
  EATING = "eating",
  BILL_REQUESTED = "bill_requested",
  PAYING = "paying",
  TIPPING = "tipping",
  LEAVING = "leaving",
  END_SESSION = "end_session",
}

// Language options
interface LanguageOption {
  code: string;
  name: string;
  flag: string;
  country: string;
  greeting: string;
  goodbye: string;
  commonPhrases: string[];
}

// Customer profile
interface Customer {
  id: string;
  name: string;
  seat: number;
  state: CustomerState;
  wants: string[];
  fallbacks: string[];
  allowOthers: boolean;
  needsMenuTime: boolean;
  politeness: "easygoing" | "neutral" | "picky";
  willTipIfGoodService: boolean;
  infoQuestions: string[];
  canPay: boolean;
  payOnlyIfMatchedItems: boolean;
  leaveOnRude: boolean;
  satisfaction: number; // 0-100
  language: LanguageOption;
  nationality: string;
}

// Restaurant info
interface RestaurantInfo {
  availableDishes: string[];
  soldOutDishes: string[];
  emptyTables: number[];
  openingHours: string;
}

// Language options
const languageOptions: LanguageOption[] = [
  {
    code: "en",
    name: "English",
    flag: "🇺🇸",
    country: "Mỹ",
    greeting: "Hello",
    goodbye: "Goodbye",
    commonPhrases: ["Thank you", "Sorry", "No problem", "Okay"],
  },
  {
    code: "vi",
    name: "Tiếng Việt",
    flag: "🇻🇳",
    country: "Việt Nam",
    greeting: "Xin chào",
    goodbye: "Tạm biệt",
    commonPhrases: ["Cảm ơn", "Xin lỗi", "Không sao", "Được rồi"],
  },
  {
    code: "ko",
    name: "한국어",
    flag: "🇰🇷",
    country: "Hàn Quốc",
    greeting: "안녕하세요",
    goodbye: "안녕히 가세요",
    commonPhrases: ["감사합니다", "죄송합니다", "괜찮습니다", "네"],
  },
  {
    code: "ja",
    name: "日本語",
    flag: "🇯🇵",
    country: "Nhật Bản",
    greeting: "こんにちは",
    goodbye: "さようなら",
    commonPhrases: ["ありがとう", "すみません", "大丈夫", "はい"],
  },
  {
    code: "zh",
    name: "中文",
    flag: "🇨🇳",
    country: "Trung Quốc",
    greeting: "你好",
    goodbye: "再见",
    commonPhrases: ["谢谢", "对不起", "没关系", "好的"],
  },
  {
    code: "th",
    name: "ไทย",
    flag: "🇹🇭",
    country: "Thái Lan",
    greeting: "สวัสดี",
    goodbye: "ลาก่อน",
    commonPhrases: ["ขอบคุณ", "ขอโทษ", "ไม่เป็นไร", "ได้"],
  },
];

// Customer names by nationality
const customerNames: { [key: string]: string[] } = {
  Mỹ: ["John Smith", "Sarah Johnson", "Mike Brown", "Lisa Davis"],
  "Việt Nam": ["Nguyễn Minh", "Trần Thị Lan", "Lê Văn Hùng", "Phạm Thị Mai"],
  "Hàn Quốc": ["김민수", "박지영", "이준호", "최수진"],
  "Nhật Bản": ["田中太郎", "佐藤花子", "鈴木一郎", "高橋美咲"],
  "Trung Quốc": ["王小明", "李小红", "张伟", "陈美丽"],
  "Thái Lan": ["สมชาย", "สมหญิง", "วิชัย", "มาลี"],
};

export default function RestaurantGame() {
  const [gameStarted, setGameStarted] = useState(false);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageOption>(
    languageOptions[0]
  );
  const [currentCustomer, setCurrentCustomer] = useState<Customer | null>(null);
  const [restaurantInfo, setRestaurantInfo] = useState<RestaurantInfo>({
    availableDishes: ["Phở Bò", "Bún Bò Huế", "Cơm Tấm", "Bánh Mì", "Gỏi Cuốn"],
    soldOutDishes: ["Chả Cá Lã Vọng"],
    emptyTables: [1, 2, 3, 4, 5, 6],
    openingHours: "7:00 - 22:00",
  });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [playerMessage, setPlayerMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [gameScore, setGameScore] = useState(0);
  const [lastAIResponse, setLastAIResponse] = useState<any>(null);
  const [showDebug, setShowDebug] = useState(false);
  const [satisfactionDelta, setSatisfactionDelta] = useState<number | null>(
    null
  );
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsCache, setTtsCache] = useState<Map<string, string>>(new Map());

  // Play TTS for given text with caching
  const handleSpeak = async (text: string) => {
    if (!text || isSpeaking) return;

    // Check cache first
    const cacheKey = text.trim();
    if (ttsCache.has(cacheKey)) {
      try {
        setIsSpeaking(true);
        const cachedUrl = ttsCache.get(cacheKey)!;
        const url = cachedUrl.startsWith("http")
          ? cachedUrl
          : `${window.location.origin}${cachedUrl}`;
        const audio = new Audio(url);

        // Listen for audio end to reset speaking state
        audio.addEventListener("ended", () => {
          setIsSpeaking(false);
        });

        audio.addEventListener("error", () => {
          setIsSpeaking(false);
        });

        await audio.play();
        return;
      } catch (e) {
        console.error("TTS cache play error:", e);
        setIsSpeaking(false);
        // Remove invalid cache entry
        setTtsCache((prev) => {
          const newCache = new Map(prev);
          newCache.delete(cacheKey);
          return newCache;
        });
      }
    }

    try {
      setIsSpeaking(true);
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          voice: "alloy",
          model: "tts-1",
        }),
      });
      if (!res.ok) throw new Error("TTS request failed");
      const data = await res.json();
      const audioUrl: string = data.audioUrl || data.url;
      if (!audioUrl) throw new Error("No audioUrl returned");

      // Cache the URL
      setTtsCache((prev) => new Map(prev).set(cacheKey, audioUrl));

      const url = audioUrl.startsWith("http")
        ? audioUrl
        : `${window.location.origin}${audioUrl}`;
      const audio = new Audio(url);

      // Listen for audio end to reset speaking state
      audio.addEventListener("ended", () => {
        setIsSpeaking(false);
      });

      audio.addEventListener("error", () => {
        setIsSpeaking(false);
      });

      await audio.play();
    } catch (e) {
      console.error("TTS play error:", e);
      setIsSpeaking(false);
    }
  };

  // Detect rude/offensive language from player
  const isRude = (text: string) => {
    const rudeWords = [
      // Vietnamese
      "cút",
      "đồ ngu",
      "địt",
      "đm",
      "đồ điên",
      "mẹ mày",
      "cmm",
      "biến đi",
      // English
      "fuck",
      "idiot",
      "stupid",
      "moron",
      "get lost",
      "go away",
      // Korean
      "꺼져",
      "멍청",
      "바보",
      // Japanese
      "消えろ",
      "ばか",
      "くそ",
      // Chinese
      "滚开",
      "笨蛋",
      "傻子",
      // Thai
      "ไสหัวไป",
      "โง่",
    ];
    const lower = text.toLowerCase();
    return rudeWords.some((w) => lower.includes(w));
  };

  const getOffendedMessage = () => {
    switch (selectedLanguage.code) {
      case "vi":
        return "Xin lỗi, thái độ như vậy thật không phù hợp. Tôi sẽ rời đi.";
      case "ko":
        return "죄송하지만 그런 말투는 불편하네요. 저는 떠나겠습니다.";
      case "ja":
        return "申し訳ありませんが、その言い方は失礼です。失礼します。";
      case "zh":
        return "抱歉，这样的语气让我不舒服。我先离开了。";
      case "th":
        return "ขอโทษนะคะ/ครับ น้ำเสียงแบบนั้นไม่เหมาะสม ฉันขอลาไปก่อน";
      case "en":
      default:
        return "Sorry, that tone is not acceptable. I'm leaving now.";
    }
  };

  // Initialize customer
  const initializeCustomer = (): Customer => {
    const names = customerNames[selectedLanguage.country];
    const randomName = names[Math.floor(Math.random() * names.length)];

    return {
      id: "cust_001",
      name: randomName,
      seat: 1,
      state: CustomerState.WAITING_OUTSIDE,
      wants: ["Phở Bò", "Bún Bò Huế"],
      fallbacks: ["Cơm Tấm", "Bánh Mì"],
      allowOthers: false,
      needsMenuTime: true,
      politeness: "easygoing",
      willTipIfGoodService: true,
      infoQuestions: ["hours", "menuScope"],
      canPay: true,
      payOnlyIfMatchedItems: true,
      leaveOnRude: true,
      satisfaction: 50,
      language: selectedLanguage,
      nationality: selectedLanguage.country,
    };
  };

  // Start game
  const startGame = () => {
    const customer = initializeCustomer();
    setCurrentCustomer(customer);
    setGameStarted(true);
    setMessages([]);
    setGameScore(0);

    // Customer's opening message with context
    const getOpeningMessage = () => {
      switch (selectedLanguage.code) {
        case "vi":
          return `${selectedLanguage.greeting}! Tôi muốn ăn ở đây. Có bàn trống không ạ?`;
        case "ko":
          return `${selectedLanguage.greeting}! 여기서 식사하고 싶습니다. 빈 테이블이 있나요?`;
        case "ja":
          return `${selectedLanguage.greeting}! ここで食事をしたいです。空いているテーブルはありますか？`;
        case "zh":
          return `${selectedLanguage.greeting}! 我想在这里吃饭。有空桌子吗？`;
        case "th":
          return `${selectedLanguage.greeting}! ฉันอยากทานอาหารที่นี่ มีโต๊ะว่างไหม?`;
        case "en":
        default:
          return `${selectedLanguage.greeting}! I want to eat here. Do you have any empty tables?`;
      }
    };

    const openingMessage: ChatMessage = {
      role: "assistant",
      content: getOpeningMessage(),
    };
    setMessages([openingMessage]);
  };

  // Create system prompt for customer
  const createCustomerPrompt = (playerMessage: string) => {
    const customerInfo = currentCustomer
      ? `
Thông tin khách hàng:
- Tên: ${currentCustomer.name} ${currentCustomer.language.flag}
- Quốc tịch: ${currentCustomer.nationality}
- Ngôn ngữ: ${currentCustomer.language.name}
- Trạng thái hiện tại: ${currentCustomer.state}
- Mức độ hài lòng: ${currentCustomer.satisfaction}%
- Tính cách: ${currentCustomer.politeness}
- Muốn ăn: ${currentCustomer.wants.join(", ")}
- Món thay thế: ${currentCustomer.fallbacks.join(", ")}
- Cần xem menu: ${currentCustomer.needsMenuTime ? "Có" : "Không"}
- Có thể thanh toán: ${currentCustomer.canPay ? "Có" : "Không"}
- Sẽ tip nếu service tốt: ${
          currentCustomer.willTipIfGoodService ? "Có" : "Không"
        }
`
      : "";

    return `Bạn là khách hàng ${
      currentCustomer?.nationality
    } trong nhà hàng Việt Nam. Bạn đang nói chuyện với nhân viên phục vụ (người chơi). 

${customerInfo}

Hãy trả lời như một khách hàng thật sự:
- Lịch sự và thân thiện
- Hỏi về menu, bàn, món ăn
- Thể hiện sở thích cá nhân
- Phản ứng theo tính cách của bạn
- Không đóng vai nhân viên phục vụ
- Có thể sử dụng một số từ ngữ của quốc gia mình: ${currentCustomer?.language.commonPhrases.join(
      ", "
    )}
- Chào hỏi bằng: ${currentCustomer?.language.greeting}
- Tạm biệt bằng: ${currentCustomer?.language.goodbye}

Nhân viên phục vụ vừa nói: "${playerMessage}"

QUAN TRỌNG: Bạn phải trả lời theo format JSON sau:
{
  "response": "Câu trả lời của khách hàng",
  "state": "Trạng thái mới (waiting_outside, confirm_seating, seated_idle, request_menu, ordering, kitchen_pending, kitchen_ready, serving, eating, bill_requested, paying, tipping, leaving, end_session)",
  "satisfaction_change": "Số điểm thay đổi satisfaction (-30 đến 30, KHÔNG dùng dấu +)",
  "intent": "Mục đích của khách hàng (greeting, request_menu, order_food, ask_question, etc.)",
  "party_size": "Số người trong nhóm (nếu có)",
  "order_items": "Món ăn đã order (nếu có)"
}

LƯU Ý: satisfaction_change phải là số nguyên, không dùng dấu + (ví dụ: 10 thay vì +10)

QUY TẮC QUAN TRỌNG VỀ THÁI ĐỘ:
- Nếu nhân viên nói thô lỗ, xúc phạm (ví dụ: "cút", "ngu", "đi khỏi", "fuck", "idiot", "stupid", các từ chửi tục bằng tiếng Việt/Anh/Hàn/Nhật/Trung/Thái), hãy:
  - Đặt intent = "offended"
  - Đặt state = "leaving"
  - Đặt satisfaction_change là số âm lớn trong khoảng [-30, -10]
  - Phản hồi ngắn gọn thể hiện sự khó chịu và bạn sẽ rời đi ngay.

Hãy trả lời như khách hàng ${currentCustomer?.nationality}:`;
  };

  // Send message to customer
  const sendMessage = async () => {
    if (!playerMessage.trim() || !currentCustomer || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: playerMessage,
    };

    setMessages((prev) => [...prev, userMessage]);
    setPlayerMessage("");
    setIsLoading(true);

    // Client-side rude detection: force customer to leave immediately
    if (isRude(userMessage.content)) {
      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: getOffendedMessage(),
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Apply strong negative satisfaction and leaving state
      const aiLike = {
        state: CustomerState.LEAVING,
        satisfaction_change: -20,
        intent: "offended",
      } as any;
      updateCustomerStateFromAI(aiLike);
      setIsLoading(false);
      return;
    }

    try {
      // Call Groq API to get customer response
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: createCustomerPrompt(playerMessage),
          model: "gpt-3.5-turbo",
          context: {
            messages: messages,
            role: "assistant",
          },
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const rawResponse =
          data.choices[0]?.message?.content || "Xin lỗi, tôi không hiểu.";

        // Parse AI response for JSON structure
        const parsedResponse = parseAIResponse(rawResponse);

        const assistantMessage: ChatMessage = {
          role: "assistant",
          content: parsedResponse.response,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update customer state based on AI JSON response
        updateCustomerStateFromAI(parsedResponse);

        // Store last AI response for debugging
        setLastAIResponse(parsedResponse);
      }
    } catch (error) {
      console.error("Error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Parse AI response JSON
  const parseAIResponse = (response: string) => {
    try {
      // Try to extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        let jsonStr = jsonMatch[0];

        // Fix common JSON issues
        // Remove + signs from positive numbers
        jsonStr = jsonStr.replace(/:\s*\+(\d+)/g, ": $1");

        // Fix other common JSON issues
        jsonStr = jsonStr.replace(/,\s*}/g, "}"); // Remove trailing commas
        jsonStr = jsonStr.replace(/,\s*]/g, "]"); // Remove trailing commas in arrays

        const parsed = JSON.parse(jsonStr);
        return {
          response: parsed.response || response,
          state: parsed.state,
          satisfaction_change: parsed.satisfaction_change || 0,
          intent: parsed.intent,
          party_size: parsed.party_size,
          order_items: parsed.order_items,
        };
      }
    } catch (error) {
      console.error("Failed to parse AI response:", error);
      console.error("Raw response:", response);
    }

    // Fallback to original response
    return {
      response: response,
      state: null,
      satisfaction_change: 0,
      intent: null,
      party_size: null,
      order_items: null,
    };
  };

  // Update customer state based on AI JSON response
  const updateCustomerStateFromAI = (aiResponse: any) => {
    if (!currentCustomer || !aiResponse.state) return;

    const newState = aiResponse.state as CustomerState;
    const satisfactionChange = parseInt(aiResponse.satisfaction_change) || 0;
    const newSatisfaction = Math.max(
      0,
      Math.min(100, currentCustomer.satisfaction + satisfactionChange)
    );

    // Update customer
    setCurrentCustomer((prev) =>
      prev
        ? {
            ...prev,
            state: newState,
            satisfaction: newSatisfaction,
          }
        : null
    );

    // Show floating delta on avatar
    setSatisfactionDelta(satisfactionChange);
    setTimeout(() => setSatisfactionDelta(null), 2000);

    // Update score
    if (newState !== currentCustomer.state) {
      setGameScore((prev) => prev + 10);
    }

    // Log state change
    console.log(`State changed: ${currentCustomer.state} -> ${newState}`);
    console.log(
      `Satisfaction: ${currentCustomer.satisfaction} -> ${newSatisfaction}`
    );
    console.log(`Intent: ${aiResponse.intent}`);
    if (aiResponse.order_items) {
      console.log(`Order items: ${aiResponse.order_items}`);
    }

    // Auto replace customer after leaving or when satisfaction hits 0
    if (
      newState === CustomerState.LEAVING ||
      newState === CustomerState.END_SESSION ||
      newSatisfaction === 0
    ) {
      setTimeout(() => {
        const nextCustomer = initializeCustomer();
        setCurrentCustomer(nextCustomer);
        setMessages([]);

        // create opening for new customer
        const getOpeningMessage = () => {
          switch (nextCustomer.language.code) {
            case "vi":
              return `${nextCustomer.language.greeting}! Tôi muốn ăn ở đây. Có bàn trống không ạ?`;
            case "ko":
              return `${nextCustomer.language.greeting}! 여기서 식사하고 싶습니다. 빈 테이블이 있나요?`;
            case "ja":
              return `${nextCustomer.language.greeting}! ここで食事をしたいです。空いているテーブルはありますか？`;
            case "zh":
              return `${nextCustomer.language.greeting}! 我想在这里吃饭。有空桌子吗？`;
            case "th":
              return `${nextCustomer.language.greeting}! ฉันอยากทานอาหารที่นี่ มีโต๊ะว่างไหม?`;
            case "en":
            default:
              return `${nextCustomer.language.greeting}! I want to eat here. Do you have any empty tables?`;
          }
        };

        const openingMessage: ChatMessage = {
          role: "assistant",
          content: getOpeningMessage(),
        };
        setMessages([openingMessage]);
      }, 5000);
    }
  };

  // Get customer speech bubble content (last message from customer)
  const getCustomerSpeechBubble = () => {
    if (!messages.length) {
      switch (selectedLanguage.code) {
        case "vi":
          return `${selectedLanguage.greeting}! Tôi muốn ăn ở đây. Có bàn trống không ạ?`;
        case "ko":
          return `${selectedLanguage.greeting}! 여기서 식사하고 싶습니다. 빈 테이블이 있나요?`;
        case "ja":
          return `${selectedLanguage.greeting}! ここで食事をしたいです。空いているテーブルはありますか？`;
        case "zh":
          return `${selectedLanguage.greeting}! 我想在这里吃饭。有空桌子吗？`;
        case "th":
          return `${selectedLanguage.greeting}! ฉันอยากทานอาหารที่นี่ มีโต๊ะว่างไหม?`;
        case "en":
        default:
          return `${selectedLanguage.greeting}! I want to eat here. Do you have any empty tables?`;
      }
    }

    // Find the last message from customer (assistant role)
    const customerMessages = messages.filter((msg) => msg.role === "assistant");
    if (customerMessages.length > 0) {
      return customerMessages[customerMessages.length - 1].content;
    }

    // Fallback to default opening message
    switch (selectedLanguage.code) {
      case "vi":
        return `${selectedLanguage.greeting}! Tôi muốn ăn ở đây. Có bàn trống không ạ?`;
      case "ko":
        return `${selectedLanguage.greeting}! 여기서 식사하고 싶습니다. 빈 테이블이 있나요?`;
      case "ja":
        return `${selectedLanguage.greeting}! ここで食事をしたいです。空いているテーブルはありますか？`;
      case "zh":
        return `${selectedLanguage.greeting}! 我想在这里吃饭。有空桌子吗？`;
      case "th":
        return `${selectedLanguage.greeting}! ฉันอยากทานอาหารที่นี่ มีโต๊ะว่างไหม?`;
      case "en":
      default:
        return `${selectedLanguage.greeting}! I want to eat here. Do you have any empty tables?`;
    }
  };

  // Get customer emotion based on satisfaction
  const getCustomerEmotion = () => {
    if (!currentCustomer) return "😐";

    if (currentCustomer.satisfaction >= 80) return "😊";
    if (currentCustomer.satisfaction >= 60) return "🙂";
    if (currentCustomer.satisfaction >= 40) return "😐";
    if (currentCustomer.satisfaction >= 20) return "😕";
    return "😠";
  };

  if (!gameStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-100 to-red-100 flex items-center justify-center">
        <div className="bg-white p-8 rounded-lg shadow-lg text-center max-w-2xl">
          <h1 className="text-3xl font-bold text-orange-600 mb-4">
            🍜 Restaurant Game
          </h1>
          <p className="text-gray-600 mb-6">
            Bạn là nhân viên phục vụ. Hãy phục vụ khách hàng thật tốt!
          </p>

          {/* Language Selection */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4">Chọn khách hàng:</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {languageOptions.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => setSelectedLanguage(lang)}
                  className={`p-3 rounded-lg border-2 transition-colors ${
                    selectedLanguage.code === lang.code
                      ? "border-orange-500 bg-orange-100"
                      : "border-gray-300 hover:border-orange-300"
                  }`}
                >
                  <div className="text-2xl mb-1">{lang.flag}</div>
                  <div className="text-sm font-medium">{lang.name}</div>
                  <div className="text-xs text-gray-600">{lang.country}</div>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startGame}
            className="bg-orange-500 text-white px-6 py-3 rounded-lg hover:bg-orange-600 transition-colors"
          >
            Bắt đầu game với khách hàng {selectedLanguage.flag}{" "}
            {selectedLanguage.country}
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style jsx>{`
        @keyframes satisfactionFloat {
          0% {
            opacity: 0;
            transform: translate(-50%, 0) scale(0.5);
          }
          20% {
            opacity: 1;
            transform: translate(-50%, -10px) scale(1.2);
          }
          80% {
            opacity: 1;
            transform: translate(-50%, -30px) scale(1);
          }
          100% {
            opacity: 0;
            transform: translate(-50%, -50px) scale(0.8);
          }
        }
      `}</style>
      <div className="min-h-screen bg-gradient-to-br from-orange-100 to-red-100">
        {/* Navigation */}
        <nav className="bg-white shadow-sm p-4">
          <div className="max-w-6xl mx-auto flex justify-between items-center">
            <h1 className="text-xl font-bold text-orange-600">
              🍜 Restaurant Game
            </h1>
            <div className="flex gap-4">
              <Link
                href="/"
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Chat Demo
              </Link>
              <Link
                href="/restaurant"
                className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
              >
                Restaurant Game
              </Link>
            </div>
          </div>
        </nav>

        <div className="p-4">
          <div className="max-w-6xl mx-auto">
            {/* Game Header */}
            <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
              <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold text-orange-600">
                  🍜 Restaurant Game
                </h2>
                <div className="flex gap-4">
                  <div className="text-sm">
                    <span className="font-semibold">Điểm:</span> {gameScore}
                  </div>
                  <div className="text-sm">
                    <span className="font-semibold">Hài lòng:</span>{" "}
                    {currentCustomer?.satisfaction}%
                  </div>
                  <button
                    onClick={() => setShowDebug(!showDebug)}
                    className="text-sm bg-gray-500 text-white px-2 py-1 rounded hover:bg-gray-600"
                  >
                    {showDebug ? "Ẩn Debug" : "Debug"}
                  </button>
                </div>
              </div>
            </div>

            {/* Debug Panel */}
            {showDebug && lastAIResponse && (
              <div className="bg-gray-900 text-green-400 rounded-lg shadow-lg p-4 mb-4 font-mono text-sm">
                <h3 className="text-lg font-semibold mb-2 text-white">
                  🤖 AI Response Debug:
                </h3>
                <div className="space-y-2">
                  <div>
                    <span className="text-yellow-400">State:</span>{" "}
                    {lastAIResponse.state || "N/A"}
                  </div>
                  <div>
                    <span className="text-yellow-400">
                      Satisfaction Change:
                    </span>{" "}
                    {lastAIResponse.satisfaction_change || 0}
                  </div>
                  <div>
                    <span className="text-yellow-400">Intent:</span>{" "}
                    {lastAIResponse.intent || "N/A"}
                  </div>
                  {lastAIResponse.party_size && (
                    <div>
                      <span className="text-yellow-400">Party Size:</span>{" "}
                      {lastAIResponse.party_size}
                    </div>
                  )}
                  {lastAIResponse.order_items && (
                    <div>
                      <span className="text-yellow-400">Order Items:</span>{" "}
                      {lastAIResponse.order_items}
                    </div>
                  )}
                  <div className="mt-2 p-2 bg-gray-800 rounded">
                    <span className="text-yellow-400">Raw JSON:</span>
                    <pre className="mt-1 text-xs overflow-x-auto">
                      {JSON.stringify(lastAIResponse, null, 2)}
                    </pre>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {/* Restaurant Info */}
              <div className="bg-white rounded-lg shadow-lg p-4">
                <h2 className="text-lg font-semibold mb-3">
                  🏪 Thông tin nhà hàng
                </h2>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-semibold">Món có sẵn:</span>
                    <ul className="ml-2">
                      {restaurantInfo.availableDishes.map((dish, index) => (
                        <li key={index}>• {dish}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold">Hết món:</span>
                    <ul className="ml-2">
                      {restaurantInfo.soldOutDishes.map((dish, index) => (
                        <li key={index}>• {dish}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="font-semibold">Bàn trống:</span>{" "}
                    {restaurantInfo.emptyTables.length}
                  </div>
                  <div>
                    <span className="font-semibold">Giờ mở cửa:</span>{" "}
                    {restaurantInfo.openingHours}
                  </div>
                </div>
              </div>

              {/* Game Area */}
              <div className="lg:col-span-2">
                {/* Characters */}
                <div className="bg-white rounded-lg shadow-lg p-6 mb-4">
                  <div className="flex items-center justify-between mb-4">
                    {/* Customer (Left) */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative">
                        {/* Customer Avatar */}
                        <div
                          className={`w-20 h-20 bg-blue-500 rounded-full flex items-center justify-center text-2xl transition-all duration-300 ${
                            satisfactionDelta !== null
                              ? satisfactionDelta >= 0
                                ? "ring-4 ring-green-300 ring-opacity-75 scale-110"
                                : "ring-4 ring-red-300 ring-opacity-75 scale-110"
                              : ""
                          }`}
                        >
                          👤
                        </div>

                        {/* Floating satisfaction delta */}
                        {satisfactionDelta !== null && (
                          <div
                            className={`absolute -top-20 left-1/2 transform -translate-x-1/2 text-lg font-bold z-50 ${
                              satisfactionDelta >= 0
                                ? "text-green-600"
                                : "text-red-600"
                            }`}
                            style={{
                              animation:
                                "satisfactionFloat 2s ease-out forwards",
                            }}
                          >
                            <div
                              className={`px-3 py-1 rounded-full shadow-lg ${
                                satisfactionDelta >= 0
                                  ? "bg-green-100 border-2 border-green-300"
                                  : "bg-red-100 border-2 border-red-300"
                              }`}
                            >
                              {satisfactionDelta >= 0
                                ? `+${satisfactionDelta}`
                                : `${satisfactionDelta}`}
                            </div>
                          </div>
                        )}

                        {/* Customer Speech Bubble */}
                        <div className="absolute -top-full left-1/2 translate-y-5 transform -translate-x-1/2 bg-white border-2 border-gray-300 rounded-lg p-3 shadow-lg max-w-xs min-w-md">
                          <div className="flex items-start gap-2">
                            <div className="text-sm font-medium text-gray-800 flex-1">
                              {getCustomerSpeechBubble()}
                            </div>
                            <button
                              onClick={() =>
                                handleSpeak(getCustomerSpeechBubble())
                              }
                              disabled={isSpeaking}
                              className={`px-4 py-2 text-white rounded-lg flex items-center gap-2 ${
                                isSpeaking
                                  ? "bg-gray-400 cursor-not-allowed"
                                  : "bg-purple-500 hover:bg-purple-600"
                              }`}
                            >
                              {isSpeaking ? (
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
                                </>
                              )}
                            </button>
                          </div>
                          <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-full">
                            <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-white"></div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Player (Right) */}
                    <div className="flex-1 flex items-center justify-center">
                      <div className="relative">
                        {/* Player Avatar */}
                        <div className="w-20 h-20 bg-orange-500 rounded-full flex items-center justify-center text-2xl">
                          👨‍💼
                        </div>

                        {/* Player Speech Bubble (if there's a recent message) */}
                        {messages.length > 0 &&
                          messages[messages.length - 1].role === "user" && (
                            <div className="absolute -top-16 right-1/2 transform translate-x-1/2 bg-orange-100 border-2 border-orange-300 rounded-lg p-3 shadow-lg max-w-xs min-w-md">
                              <div className="text-sm font-medium text-gray-800">
                                {messages[messages.length - 1].content}
                              </div>
                              <div className="absolute bottom-0 right-1/2 transform translate-x-1/2 translate-y-full">
                                <div className="w-0 h-0 border-l-8 border-r-8 border-t-8 border-l-transparent border-r-transparent border-t-orange-100"></div>
                              </div>
                            </div>
                          )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between">
                    {/* Customer Info */}
                    <div className="text-center flex-1">
                      <h3 className="text-lg font-semibold">
                        {currentCustomer?.name} {currentCustomer?.language.flag}
                      </h3>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-2xl transition-all duration-500">
                          {getCustomerEmotion()}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600 transition-all duration-500">
                            {currentCustomer?.satisfaction}% hài lòng
                          </span>
                          {satisfactionDelta !== null && (
                            <span
                              className={`text-xs font-bold px-2 py-1 rounded-full transition-all duration-300 ${
                                satisfactionDelta >= 0
                                  ? "bg-green-100 text-green-700 animate-pulse"
                                  : "bg-red-100 text-red-700 animate-pulse"
                              }`}
                            >
                              {satisfactionDelta >= 0
                                ? `+${satisfactionDelta}`
                                : `${satisfactionDelta}`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded uppercase font-semibold">
                          {currentCustomer?.state.replace(/_/g, " ")}
                        </span>
                      </div>
                    </div>

                    {/* Player Info */}
                    <div className="text-center flex-1">
                      <h3 className="text-lg font-semibold">
                        Nhân viên phục vụ
                      </h3>
                      <div className="flex items-center justify-center gap-2 mt-2">
                        <span className="text-2xl">😊</span>
                        <span className="text-sm text-gray-600">
                          Đang phục vụ
                        </span>
                      </div>
                      <div className="mt-2">
                        <span className="text-sm bg-orange-100 text-orange-800 px-2 py-1 rounded uppercase font-semibold">
                          Nhân viên
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Chat Interface */}
                <div className="bg-white rounded-lg shadow-lg p-4">
                  <h3 className="text-lg font-semibold mb-3">💬 Hội thoại</h3>

                  {/* Messages */}
                  <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
                    {messages.map((message, index) => (
                      <div
                        key={index}
                        className={`flex ${
                          message.role === "user"
                            ? "justify-end"
                            : "justify-start"
                        }`}
                      >
                        <div
                          className={`max-w-xs px-3 py-2 rounded-lg ${
                            message.role === "user"
                              ? "bg-blue-500 text-white"
                              : "bg-gray-200 text-gray-800"
                          }`}
                        >
                          <div className="text-sm  mb-1 font-semibold">
                            {message.role === "user" ? "Bạn" : "Khách hàng"}
                          </div>
                          <div className="text-sm">{message.content}</div>
                        </div>
                      </div>
                    ))}

                    {/* Loading indicator */}
                    {isLoading && (
                      <div className="flex justify-start">
                        <div className="max-w-xs px-3 py-2 rounded-lg bg-gray-200 text-gray-800">
                          <div className="text-sm font-medium mb-1">
                            Khách hàng
                          </div>
                          <div className="text-sm flex items-center gap-1">
                            <span>Đang suy nghĩ</span>
                            <div className="flex gap-1">
                              <div className="w-1 h-1 bg-gray-600 rounded-full animate-bounce"></div>
                              <div
                                className="w-1 h-1 bg-gray-600 rounded-full animate-bounce"
                                style={{ animationDelay: "0.1s" }}
                              ></div>
                              <div
                                className="w-1 h-1 bg-gray-600 rounded-full animate-bounce"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Input */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={playerMessage}
                      onChange={(e) => setPlayerMessage(e.target.value)}
                      placeholder="Nhập câu trả lời của bạn..."
                      className="flex-1 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                      disabled={isLoading}
                      onKeyPress={(e) => e.key === "Enter" && sendMessage()}
                    />
                    <button
                      onClick={sendMessage}
                      disabled={isLoading || !playerMessage.trim()}
                      className="px-6 py-3 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50"
                    >
                      {isLoading ? "Đang suy nghĩ..." : "Gửi"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
