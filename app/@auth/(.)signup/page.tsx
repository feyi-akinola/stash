import SignUpForm from "@/components/SignupForm";
import Modal from "@/components/Modal";

export default async function SignUp() {
  return (
    <Modal>
      <SignUpForm />
    </Modal>
  );
}