type ButtonProps = {
  text: string;
  className?: string;
}

const Button = ({ text, className }: ButtonProps ) => {
  return (
    <div className={`bg-white text-black/80 rounded-2xl py-4 px-16 flex-center cursor-pointer
      hover:bg-white/70 transition-all duration-300 ${className}`}>
      <p className="text-lg font-bold">{text}</p>
    </div>
  );
};

export default Button;