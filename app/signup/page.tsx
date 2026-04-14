import SignUpForm from "@/components/SignupForm";
import Link from "next/link";


export default async function SignUp() {
  return (
    <div className="relative w-screen h-screen flex-center bg-black/90">
      <Link
        href="/"
        className="absolute left-0 top-0 text-2xl font-semibold text-white p-6"
      >
        Stash AI
      </Link>
      <SignUpForm />
    </div>
  );
}