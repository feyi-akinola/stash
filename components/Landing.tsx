import Link from "next/link";
import Button from "@/components/Button";

const Landing = () => {
  return (
    <main className="relative h-screen w-screen flex-center font-sans bg-black
      flex flex-col gap-24">
      <div className="flex flex-col gap-4 text-center">
        <h1 className="text-5xl font-bold">
          Work Buddy
        </h1>
        <h3 className="text-xl">
          AI-assisted work chat
        </h3>
      </div>

      <div className="flex-center gap-10">
        <Link href="/signup">
          <Button text="Sign Up"/>
        </Link>

        <Link href="/login">
          <Button text="Login"/>
        </Link>
      </div>
    </main>
  );
};

export default Landing;