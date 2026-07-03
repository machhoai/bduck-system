import "./globals.css";
import "quill/dist/quill.snow.css";
import AuthSessionProvider from "../components/providers/AuthSessionProvider";
import ToastProvider from "../components/providers/ToastProvider";
import VersionLogger from "../components/ui/VersionLogger";

export const metadata = {
    title: "Joy World Cityfuns - ERP System",
    description: "Joy World Cityfuns - Enterprise Resource Planning System",
    icons: {
        icon: "/logo/jw.png",
        shortcut: "/logo/jw.png",
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
            </head>
            <body>
                {children}
                <AuthSessionProvider />
                <ToastProvider />
                <VersionLogger />
            </body>
        </html>
    );
}
