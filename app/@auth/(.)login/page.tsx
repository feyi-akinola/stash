import SignInForm from "@/components/SigninForm";
import Modal from "@/components/Modal";

export default async function SignIn() {
  return (
    <Modal>
      <SignInForm />
    </Modal>
  );
}