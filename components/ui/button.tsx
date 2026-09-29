import type { ButtonHTMLAttributes } from "react";

type Variant = "default" | "secondary" | "destructive" | "ghost";
const styles: Record<Variant, string> = {
  default: "bg-teal-700 text-white hover:bg-teal-800",
  secondary: "bg-slate-100 text-slate-800 hover:bg-slate-200",
  destructive: "bg-red-50 text-red-700 hover:bg-red-100",
  ghost: "bg-transparent text-slate-700 hover:bg-slate-100",
};
export function Button({ variant = "default", className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={`inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-50 ${styles[variant]} ${className}`} {...props} />;
}
