import type { ReactNode } from "react";
import "./styles.css";

export const metadata = {
  title: "SILLYN — Il tuo spazio, organizzato",
  description: "Gestionale personale e business SILLYN",
  applicationName: "SILLYN",
  manifest: "/manifest.webmanifest",
  themeColor: "#0b1020"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="it"><body>{children}</body></html>;
}
