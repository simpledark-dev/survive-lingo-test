import ChatDemo from "./components/ChatDemo";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation */}
      <nav className="bg-white shadow-sm p-4">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-xl font-bold text-blue-600">Survive Lingo</h1>
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

      <ChatDemo />
    </div>
  );
}
