import Link from "next/link";
import Button from "@/components/Button";
import Image from "next/image";

const Landing = () => {
  return (
    <main className="flex flex-col lg:flex-row min-h-screen w-full bg-black">
      <div className="w-full lg:w-[30%] lg:min-w-[420px] flex flex-col justify-center p-10 lg:p-16 border-b lg:border-b-0 lg:border-r border-white/5 order-2 lg:order-1">
        <div className="flex flex-col gap-8">
          <div className="flex flex-col gap-4">
            <h1 className="text-4xl lg:text-5xl font-bold text-white tracking-tight">
              Stash AI
            </h1>
            <p className="text-lg text-white/50 leading-relaxed">
              An AI-powered collaboration tool for developers.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <Link href="/signup" className="w-full">
              <Button text="Sign Up" className="w-full" />
            </Link>
            <Link href="/login" className="w-full">
              <Button text="Login" className="w-full outline" />
            </Link>
          </div>
          
          <p className="text-xs text-white/20 mt-8">
            © 2026 Stash AI. All rights reserved.
          </p>
        </div>
      </div>

      <div className="relative w-full h-[40vh] lg:h-screen lg:w-[70%] bg-zinc-900 order-1 lg:order-2">
        <Image
          src="/images/landing-bg.jpg"
          alt="Stash AI Landing"
          fill
          priority
          sizes="(max-width: 1024px) 100vw, 70vw"
          className="object-cover opacity-80"
        />
        <div className="absolute inset-0 bg-linear-to-r from-black via-transparent to-transparent hidden lg:block" />
      </div>

    </main>
  );
};

export default Landing;