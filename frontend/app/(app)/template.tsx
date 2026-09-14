"use client";

/**
 * Route template — re-mounts on every navigation, so it's the entrance boundary. It
 * also owns the page frame: scroll, padding, and measure.
 *
 * All three live here and nowhere else. Pages must not add their own outer padding;
 * the frame is identical on every screen, so the title never jumps between tabs.
 *
 * Keep scroll, padding and max-width on this single element: children rely on
 * `h-full` resolving against it (the Outreach desk and Contacts build full-height
 * split views), which an extra nested wrapper would break.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div
      id="main-content"
      className="page-enter mx-auto h-full w-full max-w-[1680px] overflow-y-auto px-4 py-5 sm:px-6 lg:px-8 lg:py-6"
    >
      {children}
    </div>
  );
}
