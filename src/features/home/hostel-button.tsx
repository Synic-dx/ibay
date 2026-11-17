"use client";
/**
 * FEATURE: "Meet at <hostel>" button on the phone home bar
 */
import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { useApp } from "@/components/app-context";
import { HostelSheet } from "@/components/shell/hostel-sheet";

export function HostelButton() {
  const { viewer, openAuth } = useApp();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="loc" onClick={() => (viewer ? setOpen(true) : openAuth({ reason: "Sign in to set your hostel as your pickup point" }))}>
        <Icon name="pin" />
        {viewer ? `Meet at ${viewer.hostel}` : "IIM Indore campus"}
        <Icon name="down" className="icon i14" />
      </button>
      {viewer && <HostelSheet open={open} onOpenChange={setOpen} current={viewer.hostel} />}
    </>
  );
}
