 "use client";
import { timeAgo } from "@/lib/time";
import { Message, TempMessage } from "@/types/types";
import { BeatLoader } from "react-spinners";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Bot, Info, Play, Square, Trash2 } from "lucide-react";
import { ComponentPropsWithoutRef, useCallback, useEffect, useMemo, useState } from "react";
import AudioPreview from "./AudioPreview";

type ChatBubbleProps = {
  message: Message & { sending?: boolean };
  isSent: boolean;
  senderName?: string;
  failed: string | null;
  sendMessage: (message?: Message | TempMessage) => Promise<void>;
}

type MarkdownCodeProps = ComponentPropsWithoutRef<"code"> & {
  inline?: boolean;
};

const ChatBubble = ({ message, isSent, senderName, failed, sendMessage } : ChatBubbleProps) => {
  const alignment: string = isSent ? "end" : "start";
  const isAiMessage = message.role === 2;
  const bgColor: string = isSent ? "#FFFFFF" : isAiMessage ? "#dff7ff" : "#bff5ff";
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [hasFailed, setHasFailed] = useState<boolean>(failed === message.id);

  const { created_at, content, sending } = message; 
  const isVoiceMessage = message.message_type === 2;

  const speechText = useMemo(
    () =>
      content
        .replace(/```[\s\S]*?```/g, "")
        .replace(/`([^`]+)`/g, "$1")
        .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
        .replace(/[*_>#-]/g, "")
        .trim(),
    [content]
  );

  const toggleSpeech = useCallback(() => {
    if (typeof window === "undefined") return;
    if (!("speechSynthesis" in window)) return;

    if (isSpeaking) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      return;
    }

    if (!speechText) return;

    const utterance = new SpeechSynthesisUtterance(speechText);
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    setIsSpeaking(true);
  }, [isSpeaking, speechText]);

  useEffect(() => {
    setHasFailed(failed === message.id);
  }, [failed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    return () => {
      if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const retry = async () => {
    await sendMessage(message);
  }

  return (
    <div
      style={{
        alignSelf: alignment,
        alignItems: alignment,
      }}
      className="flex flex-col gap-1.5 max-w-[78%]"
    >
      {hasFailed ?
        <div onClick={retry} className="text-red-500 flex gap-1 cursor-pointer
          hover:text-amber-400 transition-all duration-200">
          <Info size={16} />
          <p className="text-xs">Click to retry</p>
        </div>
        : sending ? <BeatLoader size={8} color="#CFCFCF"/>
          : <p className="text-xs font-semibold text-zinc-600">
              {isAiMessage
                ? timeAgo(created_at)
                : <>
                    <span className="text-white/70 font-semibold">
                      {`${senderName ?? "User"}`}
                    </span>
                    {` • ${timeAgo(created_at)}`}
                  </>}
            </p>}

      <div
        style={{
          backgroundColor: bgColor,
        }}
        className="bg-white/80 text-black/80 rounded-2xl px-6 py-3 flex gap-2">
        {isVoiceMessage ? (
          <AudioPreview
            style={{ minWidth: "220px" }}
            url={content}
            isInput={false}
          />
        ) : isAiMessage ? (
          <div className="flex flex-col gap-4">
            <div className="flex justify-center items-center bg-black/20 rounded-full p-2 gap-2">
              <Bot />
              <p className="font-semibold">Assistant</p>
              <button
                type="button"
                onClick={toggleSpeech}
                className="ml-8 p-1.5 rounded-full bg-black/10 hover:bg-black/20 transition-colors cursor-pointer"
                aria-label={isSpeaking ? "Stop AI speech" : "Play AI speech"}
              >
                {isSpeaking ? <Square className="w-2.5 h-2.5 fill-black" /> : <Play className="w-2.5 h-2.5 fill-black" />}
              </button>
            </div>

            <div className="text-sm font-medium w-full max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => (
                    <p className="my-1 whitespace-pre-wrap leading-6">{children}</p>
                  ),
                  ul: ({ children }) => <ul className="list-disc pl-5 my-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-5 my-2">{children}</ol>,
                  li: ({ children }) => <li className="my-1">{children}</li>,
                  code: ({ className, children, ...props }: MarkdownCodeProps) => {
                    const language = className?.replace("language-", "") || "";
                    const codeText = String(children ?? "");
                    const isBlock = Boolean(language) || codeText.includes("\n");

                    if (!isBlock) {
                      return (
                        <code
                          className="font-mono text-[0.9em] px-1.5 py-0.5 rounded bg-black/10 text-black/90"
                          {...props}
                        >
                          {children}
                        </code>
                      );
                    }

                    return (
                      <div className="my-2 rounded-lg overflow-hidden bg-zinc-950 text-zinc-100">
                        {language && (
                          <div className="text-[11px] uppercase tracking-wide px-3 py-1 bg-zinc-800/90 text-zinc-300">
                            {language}
                          </div>
                        )}
                        <pre className="overflow-x-auto p-3 text-[13px] leading-5">
                          <code className="font-mono" {...props}>
                            {children}
                          </code>
                        </pre>
                      </div>
                    );
                  },
                }}
              >
                {content || "..."}
              </ReactMarkdown>
            </div>
          </div>
        ) : (
          <p className="text-sm font-medium w-full whitespace-pre-wrap">
            {content}
          </p>
        )}

      </div>
    </div>
  );
};

export default ChatBubble;