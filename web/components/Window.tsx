import Draggable from "react-draggable";

export function Window({
  children,
  className,
  ...props
}: { children: React.ReactNode } & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <Draggable handle=".title-bar">
      <div {...props} className={`window ${className || ""}`}>
        {children}
      </div>
    </Draggable>
  );
}
