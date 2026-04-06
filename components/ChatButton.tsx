"use client";

import { MouseEventHandler, ReactElement } from "react";

type ChatButtonProps = {
  icon: ReactElement;
  onClick?: MouseEventHandler<HTMLDivElement> | undefined;
}


const ChatButton = ({ icon, onClick } : ChatButtonProps) => {
  return (
    <>
      <div
        onClick={onClick}
        className="hover:bg-white/20 rounded-full flex-center transition-all
            duration-300 cursor-pointer p-3">
        {icon}
      </div>
    </>
  );
};

export default ChatButton;