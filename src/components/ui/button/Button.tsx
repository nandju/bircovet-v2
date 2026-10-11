import { cn } from "@/utils";
import { ReactNode } from "react";

interface ButtonProps {
  children: ReactNode; // Button text or content
  size?: "xs" | "sm" | "md"; // Button size
  variant?: "primary" | "outline" | "secondary" | "danger" | "ghost" | "soft"; // Button variant
  startIcon?: ReactNode; // Icon before the text
  endIcon?: ReactNode; // Icon after the text
  onClick?: () => void; // Click handler
  disabled?: boolean; // Disabled state
  className?: string; // Additional classes
  type?: "button" | "submit" | "reset";
  title?: string;
  form?: string;
  loading?: boolean;
}

const Button: React.FC<ButtonProps> = ({
  children,
  size = "md",
  variant = "primary",
  startIcon,
  endIcon,
  onClick,
  className = "",
  disabled = false,
  type = "button",
  title,
  form,
  loading = false,
}) => {
  // Size Classes
  const sizeClasses = {
    xs: "px-3 py-2 text-xs min-h-9",
    sm: "px-4 py-2.5 text-sm min-h-10",
    md: "px-5 py-3 text-sm min-h-11",
  };

  // Variant Classes
  const variantClasses = {
    primary: "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 disabled:bg-brand-300",
    secondary: "bg-tertiary-500 text-white shadow-theme-xs hover:bg-tertiary-600 disabled:bg-tertiary-300",
    danger: "bg-error-500 text-white shadow-theme-xs hover:bg-error-600 disabled:bg-error-300",
    soft: "bg-brand-50 text-brand-700 hover:bg-brand-100 dark:bg-brand-500/15 dark:text-brand-300 dark:hover:bg-brand-500/25",
    ghost: "bg-transparent text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-white/5",
    outline:
      "bg-white text-gray-700 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:ring-gray-700 dark:hover:bg-white/3 dark:hover:text-gray-200",
  };

  return (
    <button
      type={type}
      form={form}
      title={title}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-lg font-medium whitespace-nowrap transition",
        sizeClasses[size],
        variantClasses[variant],
        (disabled || loading) && "cursor-not-allowed opacity-50",
        className,
      )}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {loading ? (
        <span className="size-4 animate-spin rounded-full border-2 border-current border-e-transparent" aria-hidden />
      ) : (
        startIcon && <span className="flex items-center [&>svg]:size-4">{startIcon}</span>
      )}
      {children}
      {endIcon && <span className="flex items-center [&>svg]:size-4">{endIcon}</span>}
    </button>
  );
};

export default Button;
