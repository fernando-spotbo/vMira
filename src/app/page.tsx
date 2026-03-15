import { ChatProvider } from "@/context/ChatContext";
import Sidebar from "@/components/Sidebar";
import TopBar from "@/components/TopBar";
import ChatArea from "@/components/ChatArea";
import InputBar from "@/components/InputBar";

export default function Home() {
  return (
    <ChatProvider>
      <div className="flex h-screen w-screen overflow-hidden bg-gpt-gray-800">
        <Sidebar />
        <main className="flex flex-1 flex-col min-w-0">
          <TopBar />
          <ChatArea />
          <InputBar />
        </main>
      </div>
    </ChatProvider>
  );
}
