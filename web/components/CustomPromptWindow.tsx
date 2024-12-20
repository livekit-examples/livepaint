import { useState } from "react";
import { useGame } from "@/providers/GameProvider";
import { Window } from "@/components/Window";

// This window allows the player to enter a custom prompt and start the game
export function CustomPromptWindow({ onClose }: { onClose: () => void }) {
  // Our useGame hook provides us with the `startGame` function, which is all we need for this component
  const { startGame } = useGame();

  // Local state to track the custom prompt
  const [customPrompt, setCustomPrompt] = useState<string | undefined>(
    undefined,
  );

  return (
    <Window className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-100">
      <div className="title-bar">
        <div className="title-bar-text">Custom Prompt</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body">
        <div className="field-row-stacked">
          <label htmlFor="customPrompt">Enter your prompt</label>
          <input
            id="customPrompt"
            type="text"
            value={customPrompt ?? ""}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder="Steve Ballmer"
          />
        </div>
        <section className="field-row justify-end">
          <button
            onClick={() => {
              startGame(customPrompt);
              onClose();
            }}
            disabled={!customPrompt?.trim()}
          >
            Start Game
          </button>
        </section>
      </div>
    </Window>
  );
}
