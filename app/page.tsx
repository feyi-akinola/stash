import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ChatPage from "@/components/ChatPage";
import UserHydrator from "@/hooks/use-hydrator";
import Landing from "@/components/Landing";
import { Session } from "@/types/types";
import { RefreshCw } from "lucide-react";

export default async function Home() {
  let session: Session | null = null;
  let errorMsg: string | null = null;

  try {
    session = await auth.api.getSession({
      headers: await headers(),
    });

  } catch (e) {
    session = null;
    
    errorMsg = "Something went wrong. Please try again later.";
  }
  
  return (
    <>
      <UserHydrator session={session!} />

      {
        errorMsg ? (
          <div className="h-screen w-screen bg-black flex-center flex-col gap-5">              
            <p className="text-red-500 font-semibold text-sm bg-red-500/10 border px-4 py-2
              border-red-500/30 rounded-xl text-center animate-in fade-in slide-in-from-top-2"
            >
              {errorMsg}
            </p>
            <p className="text-center flex gap-1.5 text-zinc-600 text-base font-semibold">
              <RefreshCw size={20}/>
              <span>
                Refresh the page to try again
              </span>
            </p>
          </div>
        ) : (
            session
            ? <ChatPage />
            : <Landing />
        )
      }
    </>
  );
}
