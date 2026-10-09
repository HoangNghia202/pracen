import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";
import { PlayWordAudioButton } from "./play-word-audio-button";

it("calls speechSynthesis.speak with an utterance of the word", async () => {
  const speak = vi.fn();
  vi.stubGlobal("speechSynthesis", { speak, cancel: vi.fn() });
  const utteranceConstructor = vi.fn(function (this: Record<string, unknown>, text: string) {
    this.text = text;
  });
  vi.stubGlobal("SpeechSynthesisUtterance", utteranceConstructor);

  render(<PlayWordAudioButton word="Dog" />);
  await userEvent.setup().click(screen.getByRole("button", { name: "Pronounce Dog" }));

  expect(speak).toHaveBeenCalledTimes(1);
  const [utterance] = speak.mock.calls[0];
  expect(utterance.text).toBe("Dog");

  vi.unstubAllGlobals();
});
