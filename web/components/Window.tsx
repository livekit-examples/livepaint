import Draggable from "react-draggable";
import { useRef } from "react";

export function Window({
  children,
  className,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  const nodeRef = useRef<HTMLDivElement>(null);

  return (
    <Draggable handle=".title-bar" nodeRef={nodeRef}>
      <div ref={nodeRef} {...props} className={`window ${className || ""}`}>
        {children}
      </div>
    </Draggable>
  );
}
