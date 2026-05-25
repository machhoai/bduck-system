import "./globals.css";
import ToastProvider from "../components/providers/ToastProvider";

export const metadata = {
  title: "B.Duck WMS - He thong Quan ly Kho",
  description: "Joy World Cityfuns - Warehouse Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="light">
      <head>
        <meta name="color-scheme" content="light" />
      </head>
      <body>
        {children}
        <ToastProvider />
      </body>
    </html>
  );
}
