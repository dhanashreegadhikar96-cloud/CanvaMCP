import Shell from "@/nsoffice/Shell";
import { Composer } from "@/nsoffice/macros";
import { COMPOSER_CONNECTORS } from "@/lib/connectors";
import SendToCanva from "./SendToCanva";

// Clicking a card puts its prompt in the ask bar; sending opens the Canva chat with it.
const PROMPTS = [
  { title: "Search designs", desc: "Find designs in your Canva account", prompt: "Search my Canva designs for " },
  { title: "Create a design", desc: "Start a presentation, doc, poster or post", prompt: "Create a Canva presentation called " },
  { title: "Export a design", desc: "Get a PDF or PNG download link", prompt: "Export my design called " },
  { title: "Organise", desc: "Create folders and move designs", prompt: "Create a folder called " },
];

export default function HomePage() {
  return (
    <Shell activeNav="home">
      <section className="page-view active-view">
        <Composer
          prompts={PROMPTS}
          connectors={COMPOSER_CONNECTORS}
          placeholder="Tell Canva what to do: search, open, create or organise designs"
        />
      </section>
      <SendToCanva />
    </Shell>
  );
}
