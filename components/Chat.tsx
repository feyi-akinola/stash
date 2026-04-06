"use client";
import { Mic, Send } from "lucide-react";
import ChatButton from "./ChatButton";
import { Dispatch, ReactElement, SetStateAction, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import ChatBubble from "./ChatBubble";
import { Message, TempMessage } from "@/types/types";
import { BeatLoader, PuffLoader } from "react-spinners";

const icons: Record<string, ReactElement> = {
  mic: <Mic className="text-white/70 w-5 h-5"/>,
  send: <Send className="text-white/70 w-5 h-5"/>
};

type ChatProps = {
  selectedRoom: string | undefined;
  setSelectedRoom: Dispatch<SetStateAction<string | undefined>>;
  userId: string;
}

const Chat = ({ selectedRoom, setSelectedRoom, userId } : ChatProps) => {
  const PAGE_SIZE = 20;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState<number>(0);
  const [input, setInput] = useState<string>("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [amITyping, setAmITyping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);

  const prevHeight = containerRef.current?.scrollHeight || 0; // scroll position
  const prevHeightRef = useRef(0);

  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    const isNowTyping = value.length > 0;

    if (channelRef.current) {
      if (isNowTyping) {
        // Clear any existing timeout
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);

        if (!amITyping) {
          setAmITyping(true);
          channelRef.current.track({ user: userId, typing: true });
        }

        // Auto-clear typing after 2s of inactivity
        typingTimeoutRef.current = setTimeout(() => {
          setAmITyping(false);
          channelRef.current?.track({ user: userId, typing: false });
        }, 2000);
      } else {
        setAmITyping(false);
        channelRef.current.track({ user: userId, typing: false });
      }
    }
  };

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || loading || !hasMore) return;
  
    if (el.scrollTop === 0) {
      prevHeightRef.current = el.scrollHeight;

      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(nextPage);
    }
  };

  const fetchMessages = async (pageNumber: number) => {
    setLoading(true);

    try {
      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data } = await supabase
        .from("message")
        .select("*")
        .eq("room_id", selectedRoom)
        .order("created_at", { ascending: false })
        .range(from, to);

      if (data) {
        const reversed = data.reverse();
        setMessages(prev => pageNumber === 0 ? reversed : [...reversed, ...prev]);

        setTimeout(() => {
          const el = containerRef.current;
          if (!el) return; // ✅ guard
        
          const newHeight = el.scrollHeight;
          el.scrollTop = newHeight - prevHeightRef.current;
        }, 0);

        if (data.length < PAGE_SIZE) setHasMore(false);
      }

    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedRoom(undefined);
      }
    };
  
    window.addEventListener("keydown", handleEsc);
  
    return () => {
      window.removeEventListener("keydown", handleEsc);
    };
  }, []);
  
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [selectedRoom]);

  useEffect(() => {
    if (!selectedRoom) return;

    setMessages([]);
    setPage(0);
    setHasMore(true);

    fetchMessages(0);

    const channel = supabase.channel(`room:${selectedRoom}`);
    channelRef.current = channel;

    channel
      .on('postgres_changes', 
        { 
          event: 'INSERT', 
          schema: 'public', 
          table: 'message', 
          filter: `room_id=eq.${selectedRoom}`
        }, 
        (payload) => {
          const newMessage = payload.new as Message; 
          
          setMessages((current) => {
            const exists = current.some(msg => msg.id === newMessage.id);
            if (exists || newMessage.sender_id === userId) {
              return current;
            }
            return [...current, newMessage];
          });
        }
      )
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        
        const typing = Object.values(state)
          .flat()
          .some((p: any) => p.user !== userId && p.typing === true);
        setIsOtherTyping(typing);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [selectedRoom, userId]);

  const sendMessage = async () => {
    if (!input.trim() || !selectedRoom) return;
    
    const content = input;
    setInput("");
    
    if (channelRef.current) {
      setAmITyping(false);
      await channelRef.current.track({ user: userId, typing: false });  
    }

    const tempId = crypto.randomUUID();

    const optimisticMessage: TempMessage = {
      id: tempId,
      content,
      created_at: new Date().toISOString(),
      sender_id: userId,
      role: 1,
      room_id: selectedRoom,
      message_type: 1,
      sending: true,
    };

    // ✅ instantly show message
    setMessages(prev => [...prev, optimisticMessage]);

    const { data } = await supabase
      .from("message")
      .insert({
        room_id: selectedRoom,
        content,
        sender_id: userId,
        role: 1,
        message_type: 1
      })
      .select()
      .single();

    // ✅ replace temp with real message
    if (data) {
      setMessages(prev =>
        prev.map(msg =>
          msg.id === tempId ? data : msg
        )
      );
    }
  };

  return (
    <div className="flex-2 p-2 flex flex-col gap-4">
      {
        loading
          ? (
              <div className="h-full flex-center">
                <PuffLoader color="#CFCFCF" loading={loading}/>
              </div>
            )
          : (
              !selectedRoom
                ? (
                    <div className="h-full flex-center">
                      <p className="text-white/20 text-center">Chat goes here</p>
                    </div>
                  )
                : (
                    <>
                      <div
                        ref={containerRef}
                        onScroll={handleScroll}
                        className="flex-1 overflow-y-auto flex flex-col p-1 scroll-smooth"
                      >
                        {/* This div pushes messages to the bottom */}
                        <div className="flex-1" /> 
                        
                        <div className="flex flex-col gap-4">
                          {messages.map((message) => (
                            <ChatBubble 
                              key={message.id} 
                              message={message} 
                              isSent={message.sender_id === userId} 
                            />
                          ))}
                        </div>
                        
                        {isOtherTyping && (
                          <div className="p-2 self-start bg-white/5 rounded-full px-4 mt-2">
                            <BeatLoader size={5} color="#CFCFCF" />
                          </div>
                        )}
                      </div>
          
                      <div className="mt-4 bg-white/10 rounded-3xl pl-6 py-2 pr-3 flex gap-2 shrink-0">
                        <input
                          value={input}
                          onChange={handleTyping}
                          onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                          className="w-full outline-0 text-white/90 bg-transparent"
                          placeholder="Write a message..."
                        />
                        <ChatButton icon={icons.mic} />
                        <ChatButton icon={icons.send} onClick={() => sendMessage()}/>
                      </div>
                    </>
                  )
          )
      }
    </div>
  );
};

export default Chat;
