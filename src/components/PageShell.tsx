import { Atmosphere } from "@/components/Atmosphere";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export function PageShell({
  children,
  tallAtmosphere = false,
}: {
  children: React.ReactNode;
  tallAtmosphere?: boolean;
}) {
  return (
    <div className="relative flex min-h-full min-w-0 flex-col overflow-x-hidden">
      <Atmosphere tall={tallAtmosphere} />
      <SiteHeader />
      <main className="relative z-10 mx-auto w-full min-w-0 max-w-6xl flex-1 px-5 pb-20 pt-6 sm:px-8 sm:pb-28">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
