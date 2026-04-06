import { timeAgo } from "@/lib/time";
import { Message } from "@/types/types";
import { BeatLoader } from "react-spinners";

type ChatBubbleProps = {
  message: Message & { sending?: boolean };
  isSent: boolean;
}

const ChatBubble = ({ message, isSent } : ChatBubbleProps) => {
  const alignment: string = isSent ? "end" : "start";
  const bgColor: string = isSent ? "#FFFFFF" : "#bff5ff";

  const { created_at, content, sending } = message; 

  return (
    <div
      style={{
        alignSelf: alignment,
        alignItems:  alignment,
      }}
      className="flex flex-col gap-1"
    >
      { 
        sending
          ? <BeatLoader size={8} color="#CFCFCF"/>
          : (
              <p className="text-xs font-semibold text-zinc-700">
                {timeAgo(created_at)}
              </p>
            )
      }

      <div
        style={{
          backgroundColor: bgColor,
        }}
        className="bg-white/80 text-black/80 rounded-2xl px-6 py-3 flex gap-2">
        <p className="text-sm font-medium w-full">
          {content}
        </p>

      </div>
    </div>
  );
};

export default ChatBubble;