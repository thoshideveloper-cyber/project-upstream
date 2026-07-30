import { redirect } from "next/navigation";

// The public marketing site now lives in the separate `marketing/` app.
// The product app's root sends visitors into the authenticated shell
// (which bounces to /login when there's no session).
export default function Home() {
  redirect("/dashboard");
}
