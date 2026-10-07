import { cookies } from "next/headers";
import Shell from "@/nsoffice/Shell";
import { AssistantChip } from "@/nsoffice/macros";
import { isConnected } from "@/lib/canva-auth";
import { isMcpConnected } from "@/lib/canva-mcp-auth";
import CanvaChat from "./CanvaChat";

// Read the sign-in cookies on every request so the page knows which Canva connections are on.
export const dynamic = "force-dynamic";

export default async function CanvaConnectorPage() {
  const cookieStore = await cookies();
  return (
    <Shell activeNav="hive" topBarStart={<AssistantChip icon="fa-solid fa-palette" label="Canva Assistant" color="purple" />}>
      <CanvaChat connected={isConnected(cookieStore)} editorConnected={isMcpConnected(cookieStore)} />
    </Shell>
  );
}
