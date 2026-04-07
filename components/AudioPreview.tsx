import { Play, Send, Square, Trash2 } from "lucide-react";
import { CSSProperties, useRef, useState } from "react";
import ChatButton from "./ChatButton";

type AudioPreviewProps = {
  url: string;
  style?: CSSProperties;
  isInput: boolean;
  onCancel?: () => void;
  onSend?: () => void;
}

const AudioPreview = ({ url, style, isInput, onCancel, onSend }: AudioPreviewProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0); // Added for "0:01 / 0:30" feel

  const formatTime = (time: number) => {
    if (isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const togglePlay = () => {
    if (isPlaying) audioRef.current?.pause();
    else audioRef.current?.play();
    setIsPlaying(!isPlaying);
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      const p = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(p);
    }
  };

  return (
    <div
      style={style}
      className={`flex-1 flex items-center gap-3 rounded-2xl px-4 py-2 animate-in fade-in zoom-in-95 ${isInput ? "bg-white/5" : "bg-black/10"}`}>
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />
      
      {/* Play/Pause */}
      <button
        onClick={togglePlay}
        className={`w-8 h-8 flex-center rounded-full transition-colors ${isInput ? "bg-white/10 hover:bg-white/20" : "bg-black/20 hover:bg-black/30"}`}
      >
        {
          isPlaying
            ? <Square size={12} className={`${isInput ? "fill-white" : "fill-black"}`} />
            : <Play size={14} className={`ml-0.5 ${isInput ? "fill-white" : "fill-black"}`} />}
      </button>

      {/* Custom Progress Bar */}
      <div className={`flex-1 h-1.5 rounded-full overflow-hidden ${isInput ? "bg-white/10" : "bg-black/20"}`}>
        <div 
          className={`h-full ${isInput ? "bg-red-400" : "bg-black"} transition-all duration-100`} 
          style={{ width: `${progress}%` }}
        />
      </div>

      <div className={`flex text-xs font-bold tabular-nums ${isInput ? "text-white/60" : "text-black/80"}`}>
        <span>{formatTime(currentTime)}</span>/<span>{formatTime(duration)}</span>
      </div>

      {
        isInput && (
          <div className="flex gap-1">
            <ChatButton icon={<Trash2 size={18} className="text-red-400/80" />} onClick={onCancel} />
            <ChatButton icon={<Send size={18} className="text-white/70" />} onClick={onSend} />
          </div>
        )
      }
    </div>
  );
};

export default AudioPreview;