"use client";

export function BSOD() {
  return (
    <div className="absolute top-0 left-0 w-full h-full p-8 leading-relaxed bsod text-white font-[dos] text-xl font-bold">
      <div>
        <p className="inline-block px-1 mb-6 bg-white text-[#0000FF]">System</p>
        <p className="mb-6">
          Fatal exception &quot;CHEATING_DETECTED&quot; occurred at
          LivePaint.exe
          <br />
          (C:\Program Files\LivePaint\LivePaint.exe). Current application will
          be terminated.
        </p>
        <p className="mb-6">
          * Press F5 to terminate the current application. You will lose any
          unsaved information in all
          <br />
          &nbsp;&nbsp;applications.
        </p>
      </div>
    </div>
  );
}
