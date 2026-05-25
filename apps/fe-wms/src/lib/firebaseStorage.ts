import { ref, uploadBytesResumable, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";
import imageCompression from "browser-image-compression";

/**
 * Utility: Nén ảnh và chuyển sang WEBP, sau đó upload lên Firebase Storage.
 *
 * @param file File ảnh gốc do người dùng chọn (thường từ thẻ <input type="file" />)
 * @param storagePath Đường dẫn thư mục lưu trên Firebase (VD: 'products')
 * @returns Chuỗi URL tải về của ảnh (Download URL)
 */
export async function uploadImageAsWebp(
  file: File,
  storagePath: string,
): Promise<string> {
  try {
    // 1. Cấu hình nén ảnh
    const options = {
      maxSizeMB: 1, // Dung lượng tối đa mong muốn (1MB)
      maxWidthOrHeight: 1920, // Kích thước tối đa để không làm vỡ layout
      useWebWorker: true, // Dùng worker để không block UI thread
      fileType: "image/webp", // Bắt buộc convert sang WEBP theo yêu cầu
      initialQuality: 0.8,
    };

    // 2. Thực hiện nén
    const compressedFile = await imageCompression(file, options);

    // 3. Tạo tên file mới với UUID để tránh trùng lặp
    const uniqueFileName = `${crypto.randomUUID()}.webp`;
    const fullPath = `${storagePath}/${uniqueFileName}`;
    const storageRef = ref(storage, fullPath);

    // 4. Upload file lên Firebase Storage
    // Dùng uploadBytesResumable nếu muốn theo dõi % (progress),
    // nhưng ở đây ta chỉ cần trả về Promise URL.
    const snapshot = await uploadBytesResumable(storageRef, compressedFile);

    // 5. Lấy và trả về URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    return downloadURL;
  } catch (error) {
    console.error("Lỗi khi nén hoặc upload ảnh:", error);
    throw new Error("Không thể tải ảnh lên. Vui lòng thử lại.");
  }
}
