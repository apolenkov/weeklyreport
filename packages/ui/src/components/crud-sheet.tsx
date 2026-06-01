"use client";

import { Button } from "@customreport/ui/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@customreport/ui/components/ui/sheet";
import { Loader2 } from "lucide-react";
import type * as React from "react";

interface CrudSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  onSubmit?: () => void;
  submitLabel?: string;
  loading?: boolean;
}

export function CrudSheet({
  open,
  onOpenChange,
  title,
  description,
  children,
  onSubmit,
  submitLabel = "Save Changes",
  loading = false,
}: CrudSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:max-w-[400px]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          {description && <SheetDescription>{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 py-2">
          {children}
        </div>
        <SheetFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            Cancel
          </Button>
          {onSubmit && (
            <Button variant="default" onClick={onSubmit} disabled={loading}>
              {loading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                submitLabel
              )}
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
