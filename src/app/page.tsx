import { redirect } from "next/navigation";

// The app opens on Home; its ask bar hands messages to the Canva chat.
export default function Index() {
  redirect("/home");
}
