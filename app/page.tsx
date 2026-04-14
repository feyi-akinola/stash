import { auth } from "@/lib/auth";
import { headers } from "next/headers";
import ChatPage from "@/components/ChatPage";
import UserHydrator from "@/hooks/use-hydrator";
import Landing from "@/components/Landing";

export default async function Home() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  
  return (
    <>
      <UserHydrator session={session} />

      {
        session
          ? <ChatPage />
          : <Landing />
      }
    </>
  );
}
