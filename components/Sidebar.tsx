"use client";
import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { supabase } from "@/lib/supabase";
import { createRoom } from "@/app/actions/rooms";
import { Room } from "@/types/types";
import { RefreshCw, X } from "lucide-react";
import { PuffLoader } from "react-spinners";

type SidebarProps = {
  currentRoomId: string | undefined;
  onSelectRoom: Dispatch<SetStateAction<string | undefined>>;
  userId: string;
}

const Sidebar = ({ currentRoomId, onSelectRoom, userId }: SidebarProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [errorMsg, setErrorMsg] = useState<string>("");

  const fetchRooms = async () => {
    setLoading(true);

    try {
      const res = await fetch("/api/room", {
        method: "GET",
        headers: { "Content-Type": "application/json" },
      });

      if (!res.ok) throw new Error;
      
      const { data } = await res.json();
      
      if (data) {
        setRooms(data);
        setErrorMsg("");

        return;
      }
    } catch (e) {
      setErrorMsg("Failed to load chats. Click to refresh");
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchRooms();
  }, []);

  const handleCreate = async () => {
    const name = prompt("Enter room name:");
    if (name) await createRoom(name, userId);
  };

  return (
    <div className="flex-1 min-h-0 bg-white/10 rounded-3xl p-4 flex flex-col gap-4">
      {
        loading ? (
          <div className="h-full flex-center">              
            <PuffLoader color="#CFCFCF" loading={loading}/>
          </div>
        ) : errorMsg ? (
          <div className="h-full flex-center flex-col gap-5">              
            <p className="text-red-500 font-semibold text-sm bg-red-500/10 border px-4 py-2
              border-red-500/30 rounded-xl text-center animate-in fade-in slide-in-from-top-2"
            >
              {errorMsg}
            </p>
            <p
              onClick={() => fetchRooms()}
              className="text-center flex gap-1.5 text-white/20 text-sm font-medium cursor-pointer"
            >
              <RefreshCw size={18}/>
              <span>
                Click to refresh
              </span>
            </p>
          </div>
        ) : (
          <div className="h-full flex flex-col justify-between">
            {rooms.length === 0 ? (
              <div className="h-full flex-center">
                <p className="text-white/20 text-center mt-10">No chats yet</p>
              </div>
            ) : (
              <div className="h-full flex flex-col gap-4 overflow-y-auto scrollbar-thumb-only pr-1.5">                  
                {rooms.map((room) => {
                  const isRoomSelected = currentRoomId === room.id;

                  return (
                    <div
                      key={room.id}
                      onClick={() => onSelectRoom(room.id)}
                      className={`bg-black px-8 py-6 rounded-2xl transition-all 
                        duration-200 flex items-center gap-4 hover:bg-white/5 text-white/60
                        ${isRoomSelected ? "border-2 border-zinc-400 m-1 p-1 cursor-auto" : "cursor-pointer"}`}
                    >
                      <p className="w-full">
                        {room.name}
                      </p>

                      {isRoomSelected &&
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // prevents parent click
                            onSelectRoom(undefined);
                          }}
                          className="bg-white text-black p-1.5 rounded-full cursor-pointer"
                        >
                          <X size={16}/>
                        </button>
                      }
                    </div>
                  )
                })}
              </div>
            )}

            <button
              onClick={handleCreate}
              disabled={errorMsg.length > 0}
              className="bg-white text-black rounded-2xl p-4 font-bold hover:bg-zinc-200
                transition-all">
              Start New Chat
            </button>
          </div>
        )
      }
    </div>
  );
};

export default Sidebar;