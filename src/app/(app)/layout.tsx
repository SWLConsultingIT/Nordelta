import { Rail } from "@/components/shell/Rail";
import { esDemo } from "@/lib/data";
import { sesionActual } from "@/lib/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sesion = await sesionActual();
  return (
    <div className="md:grid md:grid-cols-[228px_minmax(0,1fr)] min-h-screen">
      <Rail email={sesion?.email ?? "demo@nordelta.com"} demo={esDemo} />
      <main className="px-5 md:px-7 py-6 pb-16 min-w-0">{children}</main>
    </div>
  );
}
