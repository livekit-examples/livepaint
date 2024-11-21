import { Window } from "@/components/Window";

export function HelpWindow({ onClose }: { onClose: () => void }) {
  return (
    <Window
      className="window credits-window"
      style={{
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%, -50%)",
        zIndex: 100,
      }}
    >
      <div className="title-bar">
        <div className="title-bar-text">About</div>
        <div className="title-bar-controls">
          <button aria-label="Close" onClick={onClose}></button>
        </div>
      </div>
      <div className="window-body max-w-[500px]">
        <h3 className="text-lg font-bold mt-3 mb-1">LivePaint v1.0</h3>
        <p className="text-sm">
          LivePaint is the realtime drawing game from the future. Draw the
          prompt as quickly as you can.
        </p>
        <p className="text-sm">
          An AI judge will declare the first player to accurately draw the
          prompt to be the winner.
        </p>
        <h2 className="text-sm font-bold mt-3 mb-1">Credits</h2>
        <p className="text-sm">
          This game is a demo of the{" "}
          <a href="https://livekit.io/" target="_blank">
            LiveKit Agents
          </a>{" "}
          framework, and its fully annotated source code is available on{" "}
          <a
            href="https://github.com/livekit-examples/livepaint"
            target="_blank"
          >
            GitHub
          </a>{" "}
          under the Apache 2.0 license (use it however you&apos;d like!)
        </p>
      </div>
    </Window>
  );
}
