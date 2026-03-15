import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";

export default function Home() {
  return (
    <ChatProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gpt-gray-800">
        <Sidebar />
        <main className="flex flex-1 flex-col items-center justify-center">
          <p className="text-gpt-gray-400">Chat area coming next</p>
        </main>
      </div>
    </ChatProvider>
  );
}
