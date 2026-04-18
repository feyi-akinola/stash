"use client";
import Chat from "@/components/Chat";
import Sidebar from "@/components/Sidebar";
import { signOutAction } from "@/app/actions/auth";
import { useState } from "react";
import { useUserStore } from "@/store/userStore";
import SignOutSubmitButton from "@/components/SignOutSubmitButton";

const ChatPage = () => {
  const { name: userName, id: userId } = useUserStore();
  const [selectedRoom, setSelectedRoom] = useState<string | undefined>();
  const [chatLoading, setChatLoading] = useState<boolean>(false);
  const [authError] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    return params.get("error");
  });

  const handleSelectRoom = (roomId: string | undefined) => {
    setChatLoading(roomId !== undefined);
    setSelectedRoom(roomId);
  }

  return (
    <main className="h-dvh w-screen flex-center bg-zinc-50 font-sans dark:bg-black overflow-hidden">
      <div className="flex flex-col h-[95dvh] w-[90%] min-h-0">
        <div className="flex justify-between p-3">
          <p className="nav-text">
            {userName}
          </p>
          <form 
            className="nav-text flex-center gap-2" 
            action={async () => {
              await signOutAction();
            }}
          >
            <SignOutSubmitButton />
          </form>
        </div>
        {authError && (
          <p className="text-red-400 text-sm text-center bg-red-950/40 border border-red-900 rounded-lg p-2 mb-2">
            {authError}
          </p>
        )}

        <div className="w-full h-full min-h-0 flex ring-white/20 ring-2 rounded-3xl p-2 overflow-hidden">
          <Sidebar
            userId={userId}
            handleSelectRoom={handleSelectRoom}
            currentRoomId={selectedRoom}
          />
          <Chat
            selectedRoom={selectedRoom}
            setSelectedRoom={setSelectedRoom}
            userId={userId}
            userName={userName}
            externalLoading={chatLoading}
            setExternalLoading={setChatLoading}
          />
        </div>
      </div>
    </main>
  );
};

export default ChatPage;