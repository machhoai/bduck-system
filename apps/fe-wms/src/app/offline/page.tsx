export default function OfflinePage() {
    return (
        <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
            <section className="w-full sm:max-w-80 rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
                <h1 className="text-xl font-semibold text-slate-900">
                    Không thể kết nối đến J-PULSE
                </h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                    Yêu cầu tải trang chưa đến được máy chủ. Vui lòng kiểm tra kết nối
                    hoặc thử lại sau ít phút.
                </p>
                <a
                    href="/dashboard"
                    className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    Thử kết nối lại
                </a>
            </section>
        </main>
    );
}
