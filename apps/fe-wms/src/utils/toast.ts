/**
 * Toast Utility Wrapper
 *
 * Chuẩn hóa gọi goey-toast trong toàn bộ dự án.
 * MỌI toast BẮT BUỘC phải có `title` (tiêu đề) và `description` (mô tả chi tiết).
 *
 * Sử dụng:
 *   import { showToast } from '@/lib/utils/toast';
 *
 *   // Thông báo đơn lẻ
 *   showToast.success('Thành công', 'Đơn hàng đã được duyệt và chuyển kho.');
 *   showToast.error('Lỗi duyệt đơn', 'Không thể kết nối máy chủ. Vui lòng thử lại.');
 *
 *   // Promise toast — hiển thị loading → success/error tự động
 *   await showToast.promise(
 *       fetchData(),
 *       {
 *           loading: 'Đang tải dữ liệu...',
 *           success: 'Tải thành công',
 *           error: 'Tải thất bại',
 *           successDescription: 'Dữ liệu đã được cập nhật.',
 *           errorDescription: (err) => err instanceof Error ? err.message : 'Đã xảy ra lỗi.',
 *       }
 *   );
 */
import { gooeyToast } from 'goey-toast';

/** Cấu hình mặc định cho mọi toast trong hệ thống */
const DEFAULT_CONFIG = {
    preset: 'snappy' as const,
    timing: {
        displayDuration: 6000,
    },
};

/** Tham số cho showToast.promise() */
interface PromiseToastMessages {
    /** Tiêu đề hiển thị khi đang loading */
    loading: string;
    /** Tiêu đề hiển thị khi thành công */
    success: string;
    /** Tiêu đề hiển thị khi thất bại */
    error: string;
    /** Mô tả chi tiết khi thành công */
    successDescription: string;
    /** Mô tả chi tiết khi thất bại — chuỗi hoặc hàm nhận error để hiển thị message từ server */
    errorDescription: string | ((err: unknown) => string);
}

/**
 * Wrapper bắt buộc truyền `title` và `description`.
 * Đây là điểm duy nhất gọi goey-toast trong toàn bộ codebase.
 */
export const showToast = {
    /** Thông báo thành công — hành động hoàn tất */
    success(title: string, description: string) {
        gooeyToast.success(title, {
            ...DEFAULT_CONFIG,
            description,
        });
    },

    /** Thông báo lỗi — giải thích nguyên nhân và hướng xử lý */
    error(title: string, description: string) {
        gooeyToast.error(title, {
            ...DEFAULT_CONFIG,
            description,
        });
    },

    /** Cảnh báo — hành động cần lưu ý, không chặn luồng */
    warning(title: string, description: string) {
        gooeyToast.warning(title, {
            ...DEFAULT_CONFIG,
            description,
        });
    },

    /** Thông tin — trạng thái trung lập, không phải lỗi cũng không phải thành công */
    info(title: string, description: string) {
        gooeyToast.info(title, {
            ...DEFAULT_CONFIG,
            description,
        });
    },

    /**
     * Promise toast — tự động hiển thị loading → success/error theo kết quả Promise.
     * Return lại Promise gốc để caller có thể chain/await.
     */
    promise<T>(promise: Promise<T>, messages: PromiseToastMessages): Promise<T> {
        const errorDesc = typeof messages.errorDescription === 'function'
            ? messages.errorDescription
            : () => messages.errorDescription as string;

        gooeyToast.promise(promise, {
            ...DEFAULT_CONFIG,
            loading: messages.loading,
            success: messages.success,
            error: messages.error,
            description: {
                success: messages.successDescription,
                error: errorDesc,
            },
        });

        return promise;
    },
};
