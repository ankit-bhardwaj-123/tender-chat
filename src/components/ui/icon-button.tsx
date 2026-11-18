import type * as React from "react";
import { Button } from "@/components/ui/button";

type ButtonProps = React.ComponentProps<typeof Button>;

type IconButtonProps = Omit<ButtonProps, "aria-label" | "size"> & {
  label: string;
  size?: "icon" | "icon-xs" | "icon-sm" | "icon-lg";
};

export function IconButton({ label, size = "icon", variant = "ghost", ...props }: IconButtonProps) {
  return <Button aria-label={label} title={label} size={size} variant={variant} {...props} />;
}
