"use client";
import { Mic, Send } from "lucide-react";
import ChatButton from "./ChatButton";
import { useMemo, Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
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

const useSessionId = () => useMemo(() => crypto.randomUUID(), []);

const Chat = ({ selectedRoom, setSelectedRoom, userId } : ChatProps) => {
  const PAGE_SIZE = 20;
  const TYPING_IDLE_MS = 3000;
  const TYPING_STALE_MS = 5000;
  const POST_MESSAGE_TYPING_SUPPRESS_MS = 1200;

  const sessionId = useSessionId();
  const presenceKey = `${userId}:${sessionId}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState<number>(0);
  const [input, setInput] = useState<string>("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<any>(null);
  const prevHeightRef = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingTrackRef = useRef(0);
  const suppressOtherTypingUntilRef = useRef(0);

  // --- HELPERS ---

  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior,
      });
    }
  }, []);

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    if (isTypingRef.current) {
      isTypingRef.current = false;
      if (channelRef.current) {
        channelRef.current.track({
          user: userId,
          sessionId,
          typing: false,
          ts: Date.now(),
        });
      }
    }
  }, [sessionId, userId]);

  const syncOtherTypingFromPresence = useCallback(() => {
    if (!channelRef.current) return;

    const state = channelRef.current.presenceState();
    const now = Date.now();
    if (now < suppressOtherTypingUntilRef.current) {
      setIsOtherTyping(false);
      return;
    }

    const anyoneElseTyping = Object.entries(state).some(([key, presenceList]: [string, any]) => {
      if (key === presenceKey) return false;

      return presenceList.some((p: any) => {
        const ts = typeof p.ts === "number" ? p.ts : 0;
        const isFresh = now - ts <= TYPING_STALE_MS;
        return p.user !== userId && p.typing === true && isFresh;
      });
    });

    setIsOtherTyping(anyoneElseTyping);
  }, [presenceKey, userId, TYPING_STALE_MS]);

  const handleTyping = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInput(value);

    if (!channelRef.current) return;

    if (value.trim().length > 0) {
      isTypingRef.current = true;

      // Broadcast periodically while typing so remote clients can expire stale states.
      const now = Date.now();
      if (now - lastTypingTrackRef.current > 800) {
        channelRef.current.track({
          user: userId,
          sessionId,
          typing: true,
          ts: now
        });
        lastTypingTrackRef.current = now;
      }

      // Refresh the 5s "Inactivity" timer
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    } else {
      // Manual clear (backspace) stops typing immediately
      stopTyping();
    }
  };

  const fetchMessages = async (pageNumber: number) => {
    if (!selectedRoom) return;
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
        const reversed = [...data].reverse();
        setMessages(prev => pageNumber === 0 ? reversed : [...reversed, ...prev]);

        if (pageNumber === 0) {
          setTimeout(() => scrollToBottom("auto"), 50);
        } else {
          requestAnimationFrame(() => {
            const el = containerRef.current;
            if (el) el.scrollTop = el.scrollHeight - prevHeightRef.current;
          });
        }
        if (data.length < PAGE_SIZE) setHasMore(false);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
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

  const sendMessage = async () => {
    if (!input.trim() || !selectedRoom) return;
    
    const content = input;
    setInput("");

    // --- CRITICAL FIX: Tell everyone I stopped typing FIRST ---
    stopTyping(); 

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

    if (data) {
      setMessages(prev => prev.map(msg => msg.id === tempId ? data : msg));
    }
  };

  // --- EFFECTS ---

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => { if (e.key === "Escape") setSelectedRoom(undefined); };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [setSelectedRoom]);

  // Fetch Logic
  useEffect(() => {
    if (!selectedRoom) {
      setIsOtherTyping(false);
      return;
    }
    setMessages([]);
    setPage(0);
    setHasMore(true);
    setIsOtherTyping(false);
    fetchMessages(0);
  }, [selectedRoom]);

  // Realtime Logic
  useEffect(() => {
    if (!selectedRoom) return;

    const channel = supabase.channel(`room:${selectedRoom}`, {
      config: { presence: { key: presenceKey } } // Bind presence to the specific userId
    });
    channelRef.current = channel;

    channel
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'message', filter: `room_id=eq.${selectedRoom}` }, 
        (payload) => {
          const newMessage = payload.new as Message;

          if (newMessage.sender_id !== userId) {
            suppressOtherTypingUntilRef.current = Date.now() + POST_MESSAGE_TYPING_SUPPRESS_MS;
            setIsOtherTyping(false); // 🔥 immediate clear
          }

          setMessages((current) => {
            if (current.some(msg => msg.id === newMessage.id) || newMessage.sender_id === userId) return current;
            return [...current, newMessage];
          });
        }
      )
      .on('presence', { event: '*' }, () => {
        syncOtherTypingFromPresence();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          // Ensure we do not leave stale typing=true when joining/rejoining.
          channel.track({
            user: userId,
            sessionId,
            typing: false,
            ts: Date.now(),
          });
        }
      });

    return () => {
      stopTyping();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [selectedRoom, userId, presenceKey, sessionId, stopTyping, syncOtherTypingFromPresence, POST_MESSAGE_TYPING_SUPPRESS_MS]);

  // Sticky Scroll
  useEffect(() => {
    if (!loading && page === 0) {
      scrollToBottom("smooth");
    }
  }, [messages, isOtherTyping, loading, page, scrollToBottom]);
  
  return (
    <div className="flex-2 p-2 flex flex-col gap-4">
      {loading && page === 0 ? (
        <div className="h-full flex-center">
          <PuffLoader color="#CFCFCF" loading={loading}/>
        </div>
      ) : !selectedRoom ? (
        <div className="h-full flex-center">
          <p className="text-white/20 text-center">Chat goes here</p>
        </div>
      ) : (
        <>
          <div
            ref={containerRef}
            onScroll={handleScroll}
            className="flex-1 overflow-y-auto flex flex-col p-1 scrollbar-hidden"
          >
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
            
            {/* OTHER PERSON IS TYPING BUBBLE */}
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
            <ChatButton icon={icons.send} onClick={sendMessage}/>
          </div>
        </>
      )}
    </div>
  );
};

export default Chat;