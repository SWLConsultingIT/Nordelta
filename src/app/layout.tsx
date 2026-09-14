import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const sans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const mono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

/**
 * El nombre visible del producto vive acá y en ningún otro lado.
 *
 * `template` se lo pone a cada pantalla: una pantalla declara «Inicio» y
 * el navegador muestra «Inicio · Pagos Nordelta». Así el día que cambie
 * el nombre —ya pasó una vez— se cambia en un lugar.
 */
const PRODUCTO = "Pagos Nordelta";

export const metadata: Metadata = {
  title: {
    default: PRODUCTO,
    template: `%s · ${PRODUCTO}`,
  },
  description:
    "Plataforma de operaciones, conciliaciones y cuentas corrientes de Nordelta.",
  applicationName: PRODUCTO,
  openGraph: {
    title: PRODUCTO,
    description: "Plataforma operativa de Nordelta. Acceso restringido al personal autorizado.",
    siteName: PRODUCTO,
    locale: "es_AR",
    type: "website",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${sans.variable} ${mono.variable} antialiased`}>{children}</body>
    </html>
  );
}
