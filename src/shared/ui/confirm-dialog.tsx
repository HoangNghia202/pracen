"use client";

import { useEffect, useState } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/shared/ui/alert-dialog";
import type { Button } from "@/shared/ui/button";

type ButtonVariant = React.ComponentProps<typeof Button>["variant"];

export interface ConfirmOptions {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  confirmVariant?: ButtonVariant;
  cancelVariant?: ButtonVariant;
}

type ConfirmRequest = ConfirmOptions & { resolve: (value: boolean) => void };

let listener: ((request: ConfirmRequest) => void) | null = null;

export function confirm(options: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    listener?.({ ...options, resolve });
  });
}

export function ConfirmDialog() {
  const [request, setRequest] = useState<ConfirmRequest | null>(null);

  useEffect(() => {
    listener = setRequest;
    return () => {
      listener = null;
    };
  }, []);

  function settle(value: boolean) {
    request?.resolve(value);
    setRequest(null);
  }

  return (
    <AlertDialog open={request !== null} onOpenChange={(open) => !open && settle(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && <AlertDialogDescription>{request.description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel variant={request?.cancelVariant ?? "outline"} onClick={() => settle(false)}>
            {request?.cancelText ?? "Cancel"}
          </AlertDialogCancel>
          <AlertDialogAction variant={request?.confirmVariant ?? "default"} onClick={() => settle(true)}>
            {request?.confirmText ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
