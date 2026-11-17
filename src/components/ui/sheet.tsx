"use client";
/**
 * FEATURE: Sheet / dialog [RUBRIC:RESPONSIVE]
 * WHAT: One accessible dialog (Radix: focus trap, Escape closes, labelled
 *       title). The prototype CSS makes it a bottom sheet on phones and a
 *       centred modal on desktop, so every flow (filters, bid, dates, delete...)
 *       uses this single component.
 */
import * as Dialog from "@radix-ui/react-dialog";
import type { ReactNode } from "react";
import { Icon } from "./icon";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  icon?: string;
  subtitle?: ReactNode;
  tall?: boolean;
  children: ReactNode;
  /** Accessible description when there is no visible subtitle. */
  description?: string;
};

export function Sheet({ open, onOpenChange, title, icon, subtitle, tall, children, description }: Props) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="scrim" />
        <Dialog.Content className={`sheet ${tall ? "tall" : ""}`}>
          <div className="grab" />
          <div className="shd">
            <div>
              <Dialog.Title asChild>
                <h2>
                  {icon && <Icon name={icon} />}
                  {title}
                </h2>
              </Dialog.Title>
              {subtitle ? (
                <Dialog.Description className="faint sm" style={{ marginTop: 2 }}>
                  {subtitle}
                </Dialog.Description>
              ) : (
                <Dialog.Description className="vh">{description ?? ""}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="x" aria-label="Close">
              <Icon name="x" />
            </Dialog.Close>
          </div>
          {children}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
