import { Rail } from "@/components/shell/Rail";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="md:grid md:grid-cols-[234px_minmax(0,1fr)] min-h-screen">
      <Rail email="santi@swlconsulting.com" />
      <main className="px-5 md:px-8 py-6 pb-16 min-w-0">{children}</main>
    </div>
  );
}
