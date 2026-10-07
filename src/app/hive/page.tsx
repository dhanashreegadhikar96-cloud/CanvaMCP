import Shell from "@/nsoffice/Shell";
import { HubCards, PageHeader } from "@/nsoffice/macros";

export default function HivePage() {
  return (
    <Shell activeNav="hive" hideTopBar>
      <section className="page-view catalog-page active-view">
        <PageHeader title="HIVE" backHref="/home" />
        <HubCards
          cards={[
            { title: "Bees", desc: "Explore AI-powered Bees by category", icon: "fa-solid fa-wand-magic-sparkles", color: "purple" },
            { title: "Connectors", desc: "Connect and manage your integrations", icon: "fa-solid fa-bolt", color: "blue", href: "/hive/connectors" },
          ]}
        />
      </section>
    </Shell>
  );
}
