"use client";
import { Mic, Send, Square, Trash2, X } from "lucide-react";
import ChatButton from "./ChatButton";
import { useMemo, Dispatch, ReactElement, SetStateAction, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import ChatBubble from "./ChatBubble";
import { Message, TempMessage } from "@/types/types";
import { BeatLoader, PuffLoader } from "react-spinners";
import { RealtimeChannel } from "@supabase/supabase-js";
import AudioPreview from "./AudioPreview";
import toast, { Toaster } from "react-hot-toast";

const icons: Record<string, ReactElement> = {
  mic: <Mic className="text-white/70 w-5 h-5"/>,
  micRecording: <Square className="text-red-400 w-5 h-5"/>,
  send: <Send className="text-white/70 w-5 h-5"/>,
  stop: <Square className="text-red-400 w-5 h-5 animate-pulse"/>,
  cancel: <Trash2 className="text-red-400/70 w-5 h-5"/>,  
};

type ChatProps = {
  selectedRoom: string | undefined;
  externalLoading: boolean;
  setSelectedRoom: Dispatch<SetStateAction<string | undefined>>;
  setExternalLoading: Dispatch<SetStateAction<boolean>>;
  userId: string;
  userName: string;
}

type TypingPresence = {
  user?: string;
  typing?: boolean;
  ts?: number;
};

type RecordingState = "idle" | "recording" | "previewing";

type InputToken =
| { type: "text"; value: string }
| { type: "command"; value: "@ai" };

const useSessionId = () => useMemo(() => crypto.randomUUID(), []);
const AI_COMMAND_REGEX = /^@ai\b/i;

const Chat = ({ selectedRoom, setSelectedRoom, userId, userName, externalLoading, setExternalLoading } : ChatProps) => {
  const PAGE_SIZE = 20;
  const TYPING_IDLE_MS = 3000;
  const TYPING_STALE_MS = 5000;
  const POST_MESSAGE_TYPING_SUPPRESS_MS = 1200;

  const sessionId = useSessionId();
  const presenceKey = `${userId}:${sessionId}`;

  const [messages, setMessages] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [page, setPage] = useState<number>(0);
  const [input, setInput] = useState<string>("");
  const [isOtherTyping, setIsOtherTyping] = useState(false);
  const [senderNames, setSenderNames] = useState<Record<string, string>>({});

  const [recordingState, setRecordingState] = useState<RecordingState>("idle");
  const [audioPreviewUrl, setAudioPreviewUrl] = useState<string | null>(null);
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const prevHeightRef = useRef(0);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isTypingRef = useRef(false);
  const lastTypingTrackRef = useRef(0);
  const suppressOtherTypingUntilRef = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  const [pageError, setPageError] = useState<string | null>(null);
  const [failedChat, setFailedChat] = useState<string | null>(null);

  const editorRef = useRef<HTMLDivElement | null>(null);

  const [showCommandMenu, setShowCommandMenu] = useState(false);
  const [commandFilter, setCommandFilter] = useState("");

  // --- HELPERS ---

  const triggerErrorToast = (message: string) => {
    toast.custom((t) => (
      <div className={`rounded-xl animate-in fade-in slide-in-from-top-2 flex-center
        ${t.visible ? 'animate-custom-enter' : 'animate-custom-leave'} px-4 py-2
        bg-[#1f0200] border border-red-500/20 gap-4`}
      >
        <p className="text-sm font-semibold text-red-400">
          {message}
        </p>

        <button
          onClick={() => toast.dismiss(t.id)}
          className="p-1 rounded-full bg-red-500 text-white cursor-pointer"
        >
          <X size={16}/>
        </button>
      </div>
    ));
  };

  const startRecording = async () => {
    try {
      stopTyping();
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        setRecordedBlob(blob);
        setAudioPreviewUrl(url);

        setRecordingState("previewing");

        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setRecordingState("recording");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        triggerErrorToast("Microphone access denied. Please check your browser settings.");
      } else {
        triggerErrorToast("Could not start recording.");
      }
    }
  };

  const finishRecording = () => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.onstop = null; 
      mediaRecorderRef.current.stop();
    }
    
    // Cleanup memory and reset to IDLE
    if (audioPreviewUrl) URL.revokeObjectURL(audioPreviewUrl);
    setAudioPreviewUrl(null);
    setRecordedBlob(null);
    setRecordingState("idle");
  }, [audioPreviewUrl]);

  const uploadAndSendVoice = async () => {
    if (!recordedBlob || !selectedRoom) return;
    
    const tempPreview = audioPreviewUrl;

    setRecordingState("idle");
    setAudioPreviewUrl(null);
    setRecordedBlob(null);

    const tempId = `voice-temp-${crypto.randomUUID()}`;
    const optimistic: TempMessage = {
      id: tempId,
      content: tempPreview || "", 
      created_at: new Date().toISOString(),
      sender_id: userId,
      role: 1,
      room_id: selectedRoom,
      message_type: 2,
      sending: true,
    };
    setMessages(prev => [...prev, optimistic]);

    try {
      // get signed upload url
      const urlRes = await fetch("/api/voice/upload-url", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: selectedRoom }),
      });
      if (!urlRes.ok) throw new Error("Failed to create signed upload URL");
      const { path, token } = await urlRes.json();

      // upload blob directly from browser to storage
      const { error: uploadError } = await supabase.storage
        .from("voice-messages")
        .uploadToSignedUrl(path, token, recordedBlob);
      if (uploadError) throw uploadError;

      // commit message row
      const commitRes = await fetch("/api/voice/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId: selectedRoom, path }),
      });
      if (!commitRes.ok) throw new Error("Failed to save voice message");
      const { message } = await commitRes.json();

      setMessages(prev => prev.map(msg => (msg.id === tempId ? message : msg)));
    } catch (err) {
      setMessages(prev => prev.map(msg => 
        msg.id === tempId ? { ...msg, sending: false, error: true } : msg
      ));
      triggerErrorToast("Failed to upload voice message.");
    }
  };

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

    const anyoneElseTyping = Object.entries(state).some(([key, presenceList]) => {
      if (key === presenceKey) return false;

      return (presenceList as TypingPresence[]).some((p) => {
        const ts = typeof p.ts === "number" ? p.ts : 0;
        const isFresh = now - ts <= TYPING_STALE_MS;
        return p.user !== userId && p.typing === true && isFresh;
      });
    });

    setIsOtherTyping(anyoneElseTyping);
  }, [presenceKey, userId, TYPING_STALE_MS]);

  const replaceLastAI = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
  
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
  
    if (node.nodeType !== Node.TEXT_NODE) return;
  
    const textNode = node as Text;
    const text = textNode.textContent || "";
  
    const match = text.slice(0, range.startOffset).match(/@ai$/);
    if (!match) return;
  
    const start = range.startOffset - match[0].length;
  
    // split text node
    const before = text.slice(0, start);
    const after = text.slice(range.startOffset);
  
    const beforeNode = document.createTextNode(before);
    const afterNode = document.createTextNode(after);
  
    const chip = document.createElement("span");
    chip.textContent = "@ai";
    chip.contentEditable = "false";
    chip.className =
      "px-2 py-0.5 mx-1 bg-blue-500/20 text-blue-300 rounded-full text-sm";
  
    const parent = textNode.parentNode!;
    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(chip, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);
  
    // move cursor after chip
    const newRange = document.createRange();
    newRange.setStart(afterNode, 0);
    newRange.setEnd(afterNode, 0);
  
    sel.removeAllRanges();
    sel.addRange(newRange);
  };

  const handleInput = () => {
    const el = editorRef.current;
    if (!el) return;
  
    const text = el.innerText;
  
    // detect last typed "@ai "
    if (/@ai$/.test(text)) {
      replaceLastAI();
    }
    
    // --- detect @word for command menu ---
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      const node = range.startContainer;
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
        const before = (textNode.textContent || "").slice(0, range.startOffset);
        const match = before.match(/@(\w*)$/);
        if (match) {
          setShowCommandMenu(true);
          setCommandFilter(match[1]); // characters after "@"
        } else {
          setShowCommandMenu(false);
          setCommandFilter("");
        }
      } else {
        setShowCommandMenu(false);
        setCommandFilter("");
      }
    }

    if (!channelRef.current) return;

    if (text.trim().length > 0) {
      isTypingRef.current = true;

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

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    } else {
      stopTyping();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Backspace") {
      const sel = window.getSelection();
      if (!sel || !sel.rangeCount) return;
    
      const range = sel.getRangeAt(0);
      let node = range.startContainer;
    
      // Only care about text nodes at the caret
      if (node.nodeType === Node.TEXT_NODE) {
        const textNode = node as Text;
    
        // Case 1: we're at the very start of this text node
        if (range.startOffset === 0) {
          // walk backwards to find previous non-whitespace sibling
          let prev: ChildNode | null = textNode.previousSibling;
          while (prev && prev.nodeType === Node.TEXT_NODE && !prev.textContent?.trim()) {
            prev = prev.previousSibling;
          }
    
          if (prev instanceof HTMLElement && prev.textContent === "@ai") {
            e.preventDefault();
            prev.remove();
            return;
          }
        }
    
        // Case 2: we're right after a space that follows the chip
        if (range.startOffset === 1 && textNode.textContent === " ") {
          let prev: ChildNode | null = textNode.previousSibling;
          while (prev && prev.nodeType === Node.TEXT_NODE && !prev.textContent?.trim()) {
            prev = prev.previousSibling;
          }
    
          if (prev instanceof HTMLElement && prev.textContent === "@ai") {
            e.preventDefault();
            prev.remove();
            return;
          }
        }
      }
    }
  
    if (e.key === "Enter") {
      e.preventDefault();
      sendMessage();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();

    const text = e.clipboardData.getData("text/plain");

    // insert plain text at cursor
    const selection = window.getSelection();
    if (!selection || !selection.rangeCount) return;

    selection.deleteFromDocument();
    selection.getRangeAt(0).insertNode(document.createTextNode(text));

    // move cursor to end of inserted text
    selection.collapseToEnd();
  }

  const handleCopy = (e: React.ClipboardEvent<HTMLDivElement>) => {
    e.preventDefault();
  
    if (!editorRef.current) return;
  
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;
  
    const range = selection.getRangeAt(0);
  
    // clone selected content
    const fragment = range.cloneContents();
  
    let text = "";
  
    const walk = (node: Node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node instanceof HTMLElement) {
        if (node.textContent === "@ai") {
          text += "@ai ";
        } else {
          node.childNodes.forEach(walk);
        }
      }
    };
  
    fragment.childNodes.forEach(walk);
  
    e.clipboardData.setData("text/plain", text.trim());
  };

  const insertAICommandFromMenu = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return;
  
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== Node.TEXT_NODE) return;
  
    const textNode = node as Text;
    const text = textNode.textContent || "";
    const before = text.slice(0, range.startOffset);
    const after = text.slice(range.startOffset);
  
    const match = before.match(/@(\w*)$/);
    if (!match) return;
  
    const start = before.length - match[0].length;
    const beforeWord = before.slice(0, start);
  
    const beforeNode = document.createTextNode(beforeWord);
    const afterNode = document.createTextNode(after);
  
    const chip = document.createElement("span");
    chip.textContent = "@ai";
    chip.contentEditable = "false";
    chip.className =
      "px-2 py-0.5 mx-1 bg-blue-500/20 text-blue-300 rounded-full text-sm inline-flex items-center";
  
    const parent = textNode.parentNode!;
    parent.insertBefore(beforeNode, textNode);
    parent.insertBefore(chip, textNode);
    parent.insertBefore(afterNode, textNode);
    parent.removeChild(textNode);
  
    // move cursor after chip
    const newRange = document.createRange();
    newRange.setStart(afterNode, 0);
    newRange.setEnd(afterNode, 0);
    sel.removeAllRanges();
    sel.addRange(newRange);
  
    setShowCommandMenu(false);
    setCommandFilter("");
  };

  const getMessage = () => {
    const el = editorRef.current;
    if (!el) return { text: "", isAI: false };
  
    let text = "";
    let isAI = false;
  
    el.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent;
      } else if (node instanceof HTMLElement) {
        if (node.textContent === "@ai") {
          isAI = true;
          text += "@ai ";
        }
      }
    });
  
    return { text: text.trim(), isAI };
  };

  const fetchMessages = useCallback(async (pageNumber: number) => {
    if (!selectedRoom) return;
    setExternalLoading(true);

    try {
      const from = pageNumber * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const res = await fetch("/api/message/getMessages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: selectedRoom,
          from,
          to,
        }),
      });

      if (!res.ok) throw new Error;
      
      const { data } = await res.json();

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
      setPageError("Failed to load messages. Please try again later.");
    } finally {
      setExternalLoading(false);
    }
  }, [selectedRoom, scrollToBottom]);

  const handleScroll = () => {
    const el = containerRef.current;
    if (!el || externalLoading || !hasMore) return;
    if (el.scrollTop === 0) {
      prevHeightRef.current = el.scrollHeight;
      const nextPage = page + 1;
      setPage(nextPage);
      fetchMessages(nextPage);
    }
  };

  const buildAiHistory = useCallback(
    (latestUserInput: string) => {
      const recent = [...messages, {
        id: "pending-user-message",
        content: latestUserInput,
        created_at: new Date().toISOString(),
        sender_id: userId,
        room_id: selectedRoom ?? "",
        message_type: 1 as const,
        role: 1 as const,
      }]
        .filter((msg) => msg.message_type === 1)
        .filter((msg) => !("sending" in msg && msg.sending))
        .slice(-10);

      return recent.map((msg) => ({
        role: msg.role === 2 ? "assistant" : "user",
        content: msg.content,
      }));
    },
    [messages, selectedRoom, userId]
  );

  const sendMessage = async (message?: Message) => {
    const { text, isAI } = getMessage();
  
    if (!text) return;
  
    console.log({ text, isAI });
  
    // clear editor
    if (editorRef.current) editorRef.current.innerHTML = "";

    let optimisticMessage: TempMessage;
    let content, tempId, isAiCommand, aiPrompt;

    if (!message) {
      if (!text.trim() || !selectedRoom) return;
      
      content = text.trim();
      isAiCommand = AI_COMMAND_REGEX.test(content);
      tempId = crypto.randomUUID();
      aiPrompt = content.replace(AI_COMMAND_REGEX, "").trim();

      if (isAiCommand && !aiPrompt) return;
      
      setInput("");
      stopTyping();
  
      optimisticMessage = {
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
    } else {
      setFailedChat(null);

      optimisticMessage = {
        ...message,
        sending: true,
      };

      tempId = message.id;
      content = message.content;
    }

    try {
      const res = await fetch("/api/message/sendMessage", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          room_id: selectedRoom,
          content,
          message_type: 1,
          role: 1
        }),
      });

      if (!res.ok) throw new Error;
      
      const { data } = await res.json();

      if (data) {
        const sentMessage = {
          ...data,
          sending: false,
        };

        setMessages(prev => prev.map(msg => msg.id === tempId ? sentMessage : msg));
      }

      if (isAiCommand) {
        const aiTempId = `ai-temp-${crypto.randomUUID()}`;

        try {
          const history = buildAiHistory(content);
          const aiOptimisticMessage: TempMessage = {
            id: aiTempId,
            content: "",
            created_at: new Date().toISOString(),
            sender_id: userId,
            role: 2,
            room_id: selectedRoom as string,
            message_type: 1,
            sending: true,
          };
          
          setMessages(prev => [...prev, aiOptimisticMessage]);
  
          const response = await fetch("/api/chat", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              prompt: aiPrompt,
              roomId: selectedRoom,
              userId,
              history,
            }),
          });
          
          if (!response.ok || !response.body) throw new Error("AI Offline");
  
          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let accumulated = "";
  
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            accumulated += decoder.decode(value, { stream: true });
            setMessages(prev =>
              prev.map(msg =>
                msg.id === aiTempId
                  ? { ...msg, content: accumulated, sending: false }
                  : msg
              )
            );
          }
  
          const finalChunk = decoder.decode();
  
          if (finalChunk) {
            accumulated += finalChunk;
            setMessages(prev =>
              prev.map(msg =>
                msg.id === aiTempId
                  ? { ...msg, content: accumulated, sending: false }
                  : msg
              )
            );
          }
        } catch (e) {
          setMessages(prev =>
            prev.map(msg =>
              msg.id === aiTempId
                ? {
                    ...msg,
                    content: "⚠️AI request failed. Please try again.",
                    sending: false,
                  }
                : msg
            )
          );
        }
      }
    } catch (error) {
      setFailedChat(tempId);
    }
  };

  // --- EFFECTS ---

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelectedRoom(undefined);
    };
    window.addEventListener("keydown", handleEsc);

    return () => window.removeEventListener("keydown", handleEsc);
  }, [setSelectedRoom]);

  // Fetch Logic
  useEffect(() => {
    if (!selectedRoom) {
      setIsOtherTyping(false);
      return;
    }
    
    setExternalLoading(true);
    setMessages([]);
    setPage(0);
    setHasMore(true);
    setIsOtherTyping(false);
    fetchMessages(0);
  }, [selectedRoom, fetchMessages]);

  // Realtime Logic
  useEffect(() => {
    if (!selectedRoom) return;

    const channel = supabase.channel(`room:${selectedRoom}`, {
      config: { presence: { key: presenceKey } }
    });
    channelRef.current = channel;

    channel
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'message', filter: `room_id=eq.${selectedRoom}` }, 
        (payload) => {
          const newMessage = payload.new as Message;

          if (newMessage.sender_id !== userId) {
            suppressOtherTypingUntilRef.current = Date.now() + POST_MESSAGE_TYPING_SUPPRESS_MS;
            setIsOtherTyping(false);
          }

          setMessages((current) => {
            if (current.some(msg => msg.id === newMessage.id)) return current;

            const aiTempIndex = current.findIndex(
              msg =>
                String(msg.id).startsWith("ai-temp-") &&
                msg.role === 2 &&
                msg.sender_id === newMessage.sender_id &&
                msg.room_id === newMessage.room_id
            );
            if (newMessage.role === 2 && aiTempIndex !== -1) {
              const next = [...current];
              next[aiTempIndex] = newMessage;
              return next;
            }

            if (newMessage.sender_id === userId && newMessage.role !== 2) return current;
            return [...current, newMessage];
          });
        }
      )
      .on('presence', { event: '*' }, () => {
        syncOtherTypingFromPresence();
      })
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
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
    if (!externalLoading && page === 0) {
      scrollToBottom("smooth");
    }
  }, [messages, isOtherTyping, externalLoading, page, scrollToBottom]);

  useEffect(() => {
    const nonAiSenderIds = Array.from(
      new Set(
        messages
          .filter(msg => msg.role !== 2)
          .map(msg => msg.sender_id)
          .filter(Boolean)
      )
    );
    const missingIds = nonAiSenderIds.filter(
      id => id !== userId && !senderNames[id]
    );
    if (missingIds.length === 0) return;

    let cancelled = false;
    const loadNames = async () => {
      const { data } = await supabase
        .from("user")
        .select("id,name")
        .in("id", missingIds);

      if (cancelled || !data) return;
      setSenderNames(prev => {
        const next = { ...prev };
        data.forEach((u: { id: string; name: string }) => {
          next[u.id] = u.name;
        });
        return next;
      });
    };

    loadNames();
    return () => {
      cancelled = true;
    };
  }, [messages, senderNames, userId]);

  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }

      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);
  
  return (
    <div className="flex-2 min-h-0 p-2 flex flex-col gap-4">
      {externalLoading && page === 0 ? (
        <div className="h-full flex-center">
          <PuffLoader color="#CFCFCF" loading={externalLoading}/>
        </div>
      ) : !selectedRoom ? (
        <div className="h-full flex-center">
          <p className="text-white/20 text-center">Chat goes here</p>
        </div>
      ) : (
        <>
          {
            pageError ? (
              <div className="h-full flex-center">
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 px-4 py-2 rounded-xl text-sm animate-in fade-in slide-in-from-top-2">
                  {pageError}
                </div>
              </div>
            ) : (
              <>
                <div
                  ref={containerRef}
                  onScroll={handleScroll}
                  className="flex-1 min-h-0 overflow-y-auto flex flex-col p-1 scrollbar-thumb-only pr-2"
                >
                  <div className="flex-1" /> 
                  <div className="flex flex-col gap-6">
                    {messages.map((message) => (
                      <ChatBubble 
                        key={message.id} 
                        message={message} 
                        isSent={message.sender_id === userId && message.role !== 2}
                        failed={failedChat}
                        sendMessage={sendMessage}
                        senderName={
                          message.role === 2
                            ? undefined
                            : message.sender_id === userId
                              ? userName
                              : senderNames[message.sender_id] ?? "Teammate"
                        }
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

                {/* INPUT AREA */}
                <div className="mt-4 bg-white/10 rounded-3xl pl-6 py-2 pr-3 flex items-center gap-2 shrink-0 min-h-[56px]">
                  {recordingState === "idle" && (
                    <>
                      <div className="relative w-full">
                        <div
                          ref={editorRef}
                          contentEditable
                          onInput={handleInput}
                          onKeyDown={handleKeyDown}
                          onPaste={handlePaste}
                          onCopy={handleCopy}
                          className="w-full outline-0 text-white/90 bg-transparent"
                          data-placeholder="Write a message..."
                        />
                        {showCommandMenu && (
                          <div className="absolute bottom-full left-0 mb-2 w-56 rounded-xl bg-black/90 border border-white/10 shadow-lg p-2 text-sm">
                            <button
                              type="button"
                              className="w-full text-left px-2 py-1.5 rounded-md hover:bg-white/10 cursor-pointer flex flex-col gap-0.5"
                              onClick={insertAICommandFromMenu}
                            >
                              <span className="font-semibold text-white">@ai</span>
                              <span className="text-xs text-white/60">Ask the assistant about this chat</span>
                            </button>
                          </div>
                        )}
                      </div>
                      <ChatButton icon={icons.mic} onClick={startRecording} />
                      <ChatButton icon={icons.send} onClick={() => sendMessage()}/>
                    </>
                  )}

                  {recordingState === "recording" && (
                    <div className="flex-1 flex items-center justify-between animate-in fade-in slide-in-from-bottom-2">
                      <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span className="text-red-400 text-sm font-medium">Recording...</span>
                      </div>
                      <div className="flex gap-2">
                        <ChatButton icon={icons.cancel} onClick={cancelRecording} />
                        <ChatButton icon={icons.stop} onClick={finishRecording} />
                      </div>
                    </div>
                  )}

                  {recordingState === "previewing" && audioPreviewUrl && (
                    <AudioPreview 
                      url={audioPreviewUrl}
                      isInput={true}
                      onCancel={cancelRecording} 
                      onSend={uploadAndSendVoice} 
                    />
                  )}
                </div>
              </>
            )
          }
        </>
      )}

      <Toaster position="top-right"/>
    </div>
  );
};

export default Chat;
