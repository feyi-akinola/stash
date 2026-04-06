"use client";
import { useState, useEffect, Dispatch, SetStateAction } from "react";
import { supabase } from "@/lib/supabase";
import { createRoom } from "@/app/actions/rooms";
import { Room } from "@/types/types";
import { Eye } from "lucide-react";
import { PuffLoader } from "react-spinners";

type SidebarProps = {
  currentRoomId: string | undefined;
  onSelectRoom: Dispatch<SetStateAction<string | undefined>>;
  userId: string;
}

const Sidebar = ({ currentRoomId, onSelectRoom, userId }: SidebarProps) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [rooms, setRooms] = useState<Room[]>([]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const { data } = await supabase
          .from("room")
          .select("*")
          .order("created_at", { ascending: false });

        if (data) setRooms(data);
      } catch (e) {
        console.log(e);
      } finally {
        setLoading(false);
      }
    };
      
    fetchRooms();
  }, []);

  const handleCreate = async () => {
    const name = prompt("Enter room name:");
    if (name) await createRoom(name, userId);
  };

  return (
    <div className="flex-1 bg-white/10 rounded-3xl p-4 flex flex-col gap-4 border-r
      border-white/5">
      <div className="flex-1 overflow-y-auto flex flex-col gap-2">
        {
          loading ? (
            <div className="h-full flex-center">              
              <PuffLoader color="#CFCFCF" loading={loading}/>
            </div>
          ) : (
            <>
              {rooms.length === 0 ? (
                <div className="h-full flex-center">
                  <p className="text-white/20 text-center mt-10">No chats yet</p>
                </div>
              ) : (
                rooms.map((room) => (
                  <div
                    key={room.id}
                    onClick={() => onSelectRoom(room.id)}
                    className={`bg-black px-4 py-6 rounded-xl cursor-pointer transition-all 
                      duration-200 flex items-center gap-4 hover:bg-white/5 text-white/60`}
                  >
                    <p className="w-full">
                      # {room.name}
                    </p>

                    {
                      currentRoomId === room.id &&
                        <Eye />
                    }
                  </div>
                ))
              )}
            </>
          )
        }
      </div>

      <button
        onClick={handleCreate}
        className="bg-white text-black rounded-2xl p-4 font-bold hover:bg-zinc-200
          transition-all">
        Start New Chat
      </button>
    </div>
  );
};

export default Sidebar;