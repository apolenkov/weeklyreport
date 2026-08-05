"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

/** Global toast host that follows the active light or dark theme. */
const Toaster = ({
  theme: themeOverride,
  style: styleOverride,
  ...props
}: Readonly<ToasterProps>) => {
  const { theme: activeTheme } = useTheme();
  const theme = themeOverride ?? activeTheme ?? "system";

  return (
    <Sonner
      theme={theme as NonNullable<ToasterProps["theme"]>}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--color-popover)",
          "--normal-text": "var(--color-popover-foreground)",
          "--normal-border": "var(--color-border)",
          "--success-bg": "var(--color-success)",
          "--success-text": "var(--color-success-foreground)",
          "--success-border": "var(--color-success-foreground)",
          "--border-radius": "var(--radius)",
          ...styleOverride,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
