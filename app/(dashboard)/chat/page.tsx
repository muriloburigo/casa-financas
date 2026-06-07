import { ChatInterface } from "@/components/chat/chat-interface";

export default function ChatPage() {
  return (
    <div className="flex flex-col h-screen">
      <div className="px-6 py-4 border-b border-zinc-200 bg-white">
        <h1 className="text-lg font-bold text-zinc-900">Assistente IA</h1>
        <p className="text-xs text-zinc-500">Powered by Claude — pergunte, registre ou analise suas finanças</p>
      </div>
      <div className="flex-1 overflow-hidden">
        <ChatInterface />
      </div>
    </div>
  );
}
