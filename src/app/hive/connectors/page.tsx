import Shell from "@/nsoffice/Shell";
import { Catalog, PageHeader } from "@/nsoffice/macros";
import { CONNECTOR_FILTERS, CONNECTORS } from "@/lib/connectors";

export default function ConnectorsPage() {
  return (
    <Shell activeNav="hive" hideTopBar>
      <section className="page-view catalog-page active-view">
        <PageHeader title="Connectors" backHref="/hive" />
        <Catalog items={CONNECTORS} filters={CONNECTOR_FILTERS} searchPlaceholder={null} buttonLabel="Use" />
      </section>
    </Shell>
  );
}
