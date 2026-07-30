"use client";

/**
 * Route template — re-mounts on every navigation, so it's the entrance-animation
 * boundary. It also owns the page frame: scroll, padding, and measure.
 *
 * All three live here and nowhere else. Pages used to add their own `p-4 sm:p-6`
 * on top of this one, so every screen was double-padded except Master List; and
 * only three of sixteen capped their width, so a wide monitor jumped between a
 * centred column and full bleed as you moved between tabs.
 *
 * Keep scroll, padding and max-width on this single element: children rely on
 * `h-full` resolving against it (the Outreach desk and Contacts build full-height
 * split views), which an extra nested wrapper would break.
 */
export default function AppTemplate({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-enter mx-auto h-full w-full max-w-[1680px] overflow-y-auto p-4 sm:p-6">
      {children}
    </div>
  );
}
