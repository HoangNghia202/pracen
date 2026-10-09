"use client";

import { SpeakerHigh } from "@phosphor-icons/react";
import { Button } from "@/shared/ui/button";

export function PlayWordAudioButton({ word }: { word: string }) {
  function handleClick() {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(word));
  }

  return (
    <Button variant="ghost" size="icon" aria-label={`Pronounce ${word}`} onClick={handleClick}>
      <SpeakerHigh className="size-4" />
    </Button>
  );
}
