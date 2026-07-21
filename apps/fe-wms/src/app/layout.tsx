import "./globals.css";
import "quill/dist/quill.snow.css";
import AuthSessionProvider from "../components/providers/AuthSessionProvider";
import AccessVersionProvider from "../components/providers/AccessVersionProvider";
import ToastProvider from "../components/providers/ToastProvider";
import VersionLogger from "../components/ui/VersionLogger";
import PwaServiceWorkerRegistrar from "../components/providers/PwaServiceWorkerRegistrar";

export const metadata = {
    title: "Joy World Cityfuns - ERP System",
    description: "Joy World Cityfuns - Enterprise Resource Planning System",
    manifest: "/manifest.webmanifest",
    icons: {
        icon: "/logo/jw.png",
        shortcut: "/logo/jw.png",
        apple: "/logo/jw.png",
    },
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
                <meta name="theme-color" content="#0066cc" />
                <meta name="apple-mobile-web-app-capable" content="yes" />
                <meta name="apple-mobile-web-app-title" content="JWC ERP" />
            </head>
            <body>
                {children}
                <AuthSessionProvider />
                <AccessVersionProvider />
                <ToastProvider />
                <VersionLogger />
                <PwaServiceWorkerRegistrar />
            </body>
        </html>
    );
}
