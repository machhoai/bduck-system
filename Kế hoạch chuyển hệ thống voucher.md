Kế hoạch được chốt theo hướng xây một module “Voucher marketing” độc lập tại `/admin/vouchers`, không đụng vào `/vouchers` đang dùng cho phiếu kho. Toàn bộ dữ liệu cũ sẽ được chuyển sang JPULSE, còn phát voucher qua sự kiện, tra cứu số điện thoại, quét và sử dụng voucher nằm ngoài phạm vi lần này.

Baseline nguồn là commit `3a07b7dbe2cb7faf9186c45f22b650726f7704a4`.

## 1. Phạm vi chức năng

Module mới phải có:

- Dashboard: tổng chiến dịch, tổng mã, đã phát, đã dùng, vô hiệu, hết hạn hiệu lực; biểu đồ trạng thái và loại ưu đãi.
- Tạo chiến dịch `EVENT` hoặc `PRINT`.
- Sinh mã theo prefix, độ dài chuỗi ngẫu nhiên, suffix và số lượng.
- Chỉnh sửa thông tin, ảnh, loại ưu đãi và mục đích chiến dịch.
- Tạo thêm mã với số lượng lớn.
- Tạm dừng/kích hoạt lại chiến dịch.
- Gia hạn toàn bộ mã `AVAILABLE` và `DISTRIBUTED`; giữ nguyên lịch sử của mã đã dùng/vô hiệu.
- Kho mã: phân trang, lọc chiến dịch/trạng thái/loại ưu đãi, tìm theo mã, sắp xếp và chọn nhiều.
- Vô hiệu từng mã hoặc hàng loạt. Không xóa cứng.
- Xuất Excel kèm QR cho chiến dịch in ấn.
- Chọn màu voucher và xem trước mẫu cố định.
- Gửi một hoặc nhiều voucher bằng Brevo.
- Theo dõi tiến độ và gửi lại các email thất bại.
- Realtime, audit log, i18n Việt–Trung, skeleton, Gooey Toast và responsive mobile.

Không triển khai trong giai đoạn này:

- Phát voucher từ sự kiện.
- Tìm voucher theo số điện thoại.
- Quét, kích hoạt hoặc redeem voucher.
- Tích hợp POS/website dùng voucher.

## 2. Quy tắc tạm dừng

`PAUSED` sẽ được kiểm tra ở service backend, không chỉ ẩn nút trên giao diện.

Khi tạm dừng, hệ thống chặn:

- Sinh thêm mã.
- Gửi email.
- Xuất Excel phục vụ in/phát voucher.
- Các job đang chạy sẽ dừng an toàn sau batch hiện tại.
- Mọi API phát, kích hoạt hoặc sử dụng voucher trong tương lai.
- Voucher đã phát cũng không sử dụng được.

Vẫn cho phép:

- Xem dữ liệu và audit.
- Gia hạn.
- Vô hiệu mã.
- Chỉnh sửa thông tin quản trị.
- Kích hoạt lại chiến dịch.

Việc tạm dừng không đổi hàng triệu mã sang trạng thái khác. Trạng thái hiệu lực được xác định bởi tổ hợp:

`campaign.status + code.status + valid_to`

Nhờ vậy kích hoạt lại không cần cập nhật hàng loạt mã.

## 3. Mô hình dữ liệu mới

Không tái sử dụng types phiếu kho trong [vouchers.ts](D:/Github/bduck-system/packages/shared-types/src/vouchers.ts). Tạo domain riêng tại `packages/shared-types/src/marketingVouchers.ts`.

### `marketing_voucher_campaigns`

| Trường chính | Ý nghĩa |
|---|---|
| `id` | Giữ nguyên ID nguồn |
| `name`, `description` | Nội dung chiến dịch |
| `reward_type`, `reward_value` | Loại và giá trị ưu đãi |
| `valid_from`, `valid_to` | Ngày hiệu lực |
| `prefix`, `code_length`, `suffix` | Quy tắc sinh mã |
| `purpose` | `EVENT` hoặc `PRINT` |
| `status` | `GENERATING`, `ACTIVE`, `PAUSED`, `ENDED`, `GENERATION_FAILED` |
| `accent_color` | Cấu hình thiết kế duy nhất người dùng chọn |
| `image_storage_path`, `image_url` | Ảnh đã chuyển sang Storage JPULSE |
| `code_counts` | Bộ đếm realtime theo trạng thái |
| `total_issued` | Số mã thực sự tạo thành công |
| `revision` | Khóa optimistic concurrency |
| `created_by`, `updated_by` | Người thao tác |
| `action_time`, `sync_time` | Thời gian local/server |
| `is_deleted` | Soft delete |
| `legacy_metadata` | ID hệ thống cũ và thông tin migration |

### `marketing_voucher_codes`

Giữ nguyên mã voucher làm document ID và chuyển đầy đủ:

- Campaign ID và tên snapshot.
- Reward type/value.
- Valid-to.
- Trạng thái gốc.
- Số điện thoại nhận.
- Thời điểm phát/dùng.
- ID và tên snapshot của nhân viên sử dụng.
- `emailed_at`, `emailed_to`.
- `is_deleted`, timestamps, revision.
- `source_hash` để đối soát và chạy lại migration an toàn.

`EXPIRED` nên là trạng thái hiệu lực được tính từ ngày, không ghi đè trạng thái lifecycle. Khi gia hạn, mã chưa dùng tự hoạt động trở lại nếu chiến dịch đang `ACTIVE`.

### Job collections

Dùng `marketing_voucher_jobs` cho:

- `GENERATE_CODES`
- `EXTEND_EXPIRY`
- `EXPORT_EXCEL`
- `SEND_EMAIL`

Mỗi job có trạng thái, idempotency key, cursor, tổng số, đã xử lý, lỗi, người tạo và timestamps. Email có subcollection item theo người nhận để retry từng nhóm mà không gửi trùng.

## 4. Khắc phục lỗi sinh số lượng lớn

Nguyên nhân chênh lệch hiện tại là API nguồn tạo campaign trước rồi ghi mã tuần tự qua nhiều batch, trong khi `totalIssued` lưu số yêu cầu thay vì số thành công.

Thiết kế mới:

1. Tạo campaign ở trạng thái `GENERATING` cùng generation job trong một transaction.
2. Worker sinh từng chunk tối đa khoảng 450 mã.
3. Mỗi chunk ghi đồng thời:

   - Các mã mới bằng create-only.
   - Bộ đếm thành công.
   - Cursor/checkpoint của job.
   - Audit record của batch.

4. Nếu trùng mã, sinh lại cho đến khi đủ số lượng yêu cầu.
5. Retry sử dụng idempotency key và checkpoint; không tạo trùng.
6. Chỉ chuyển campaign sang `ACTIVE` khi số mã thực tế bằng số yêu cầu.
7. Nếu worker lỗi, campaign ở `GENERATION_FAILED`; có thể resume từ checkpoint.
8. `total_issued` luôn lấy từ số document ghi thành công.

Cách này bảo đảm yêu cầu một triệu mã sẽ hoặc hoàn thành đủ, hoặc thể hiện rõ phần còn thiếu và tiếp tục được, thay vì báo thành công sai.

## 5. UI/UX mới

### Cấu trúc trang

- Tổng quan
- Chiến dịch
- Kho mã
- Công việc nền

Màn hình desktop dùng bảng và side panel; mobile dùng card, bottom sheet/full-screen form. Không có nút tải lại; dữ liệu tự cập nhật.

### Thiết kế voucher

Loại bỏ designer nhiều tùy chọn hiện tại. Giao diện mới chỉ có:

- Một số màu preset.
- Một color picker tùy chọn.
- Preview voucher cố định.
- Nút “Lưu màu”.

Các phần còn lại lấy tự động:

- Logo thương hiệu JPULSE/B.Duck cố định.
- Tên, mô tả và ưu đãi từ campaign.
- Ngày hết hạn từ voucher.
- QR và mã voucher từ code.
- Kích thước, typography và bố cục do hệ thống quản lý.

Nếu chưa từng chọn màu, dùng màu thương hiệu mặc định. Việc gửi email không bắt người dùng quay lại bước thiết kế.

### Luồng gửi email mới

Luồng được rút gọn:

1. Chọn voucher.
2. Nhập người nhận.
3. Soạn nội dung và xác nhận gửi.

Hỗ trợ hai chế độ hiện có:

- Nhiều voucher gộp vào một email cho một người.
- Mỗi voucher ứng với một email trong danh sách nhiều dòng.

Màn soạn chỉ có:

- Địa chỉ người nhận.
- Chủ đề.
- Nội dung giới thiệu.
- Preview dùng màu đã lưu của campaign.

Không hiển thị lại bộ thiết kế. Tên và địa chỉ người gửi lấy cố định từ cấu hình Brevo của JPULSE, tránh giả mạo sender.

Khi gửi:

- API tạo email job và trả kết quả ngay.
- Worker gửi theo batch có giới hạn concurrency.
- QR được tạo ở backend và đính kèm CID.
- Thành công mới cập nhật `emailed_at/emailed_to`.
- Kết quả hiển thị số email, số voucher thành công/thất bại và lỗi từng mã.
- “Gửi lại mã lỗi” chỉ retry item thất bại.
- Job kiểm tra `PAUSED` trước mỗi batch.

Tái sử dụng và mở rộng [brevoEmailService.ts](D:/Github/bduck-system/apps/be-wms/src/services/brevoEmailService.ts) để hỗ trợ attachments; đồng thời ghi `notification_dispatches` và audit.

## 6. Excel quy mô lớn

Xuất Excel chuyển hoàn toàn sang backend job:

- Cột giữ nguyên: mã, trạng thái, loại thưởng, giá trị, hết hạn, SĐT nhận, ngày phát, ngày dùng, QR.
- Campaign nhỏ tạo một `.xlsx`.
- Campaign lớn tự chia thành nhiều workbook và đóng gói ZIP kèm manifest.
- QR được tạo theo concurrency giới hạn.
- File lưu trên Storage JPULSE và trả signed URL có thời hạn.
- Manifest chứa số dòng, checksum và danh sách file.
- Job có thể resume/retry.
- Campaign `PAUSED` không được tạo export mới.
- File đã tạo trước khi pause vẫn được lưu phục vụ audit nhưng không hiển thị như tài liệu phát hành mới.

## 7. RBAC

Bổ sung group `marketing_vouchers` vào [permissionRegistry.ts](D:/Github/bduck-system/packages/shared-types/src/permissionRegistry.ts):

| Permission | Phạm vi |
|---|---|
| `marketing_vouchers.read` | Xem campaign, mã, thống kê và job |
| `marketing_vouchers.campaigns.write` | Tạo/sửa/tạm dừng/kích hoạt |
| `marketing_vouchers.codes.generate` | Sinh mã mới |
| `marketing_vouchers.codes.revoke` | Vô hiệu mã |
| `marketing_vouchers.campaigns.extend` | Gia hạn |
| `marketing_vouchers.export` | Xuất Excel |
| `marketing_vouchers.appearance.write` | Chọn màu mẫu |
| `marketing_vouchers.email.send` | Gửi voucher qua Brevo |

Mỗi API bắt buộc:

- `requireAuth`.
- Middleware RBAC tương ứng.
- Kiểm tra lại quyền trong service.
- Zod validation và sanitize input.
- Response `messages.vi` và `messages.zh`.
- Rate limit riêng cho generation, export và email.

Firestore client chỉ được đọc nếu có `marketing_vouchers.read`; mọi write bắt buộc đi qua backend.

## 8. Realtime và local-first

- `onSnapshot` cho campaign, counters và các job đang chạy.
- Kho mã chỉ subscribe query hiện tại với cursor/limit, không tải 1,4 triệu mã.
- Mọi mutation cập nhật counter trong transaction để dashboard realtime.
- Firestore Rules thêm `hasWorkplacePermission()` cho domain global này.
- Form/draft được giữ cục bộ bằng Zustand persisted state.
- Mỗi mutation gửi `action_time` và idempotency key; server ghi `sync_time`.
- Khi mất mạng, draft không mất; tác vụ không được báo thành công giả.
- Email và generation yêu cầu kết nối online vì là thao tác khó hoàn tác.
- Skeleton bắt buộc cho dashboard, campaign list, code list và job history.
- Mọi submit dùng `gooeyToast.promise`, có Retry và disable chống click đúp.

## 9. Migration dữ liệu

Hiện trạng đã khảo sát:

- 14 campaigns.
- 1.428.254 mã thực tế.
- `totalIssued` nguồn khai báo 1.428.859, lệch 605.
- 2 campaign thiếu `purpose`.
- 7 campaign có ảnh.
- Target production hiện chưa có collection voucher marketing.

### Quy tắc chuyển đổi

- Giữ nguyên campaign ID và code ID.
- `purpose` thiếu → `EVENT`.
- `total_issued` → số document thực tế theo campaign.
- Không bỏ các campaign/mã bị lệch.
- Không xóa hoặc thay đổi dữ liệu nguồn.
- Preserve trạng thái lifecycle; hết hạn được tính theo ngày.
- User ID cũ không khớp JPULSE vẫn được lưu trong `legacy_metadata`.
- Với mã đã dùng, lấy thêm tên nhân viên từ source làm snapshot.
- Copy ảnh sang Storage JPULSE và kiểm tra SHA-256.
- Ghi một migration audit tổng và báo cáo chi tiết theo campaign/status.

### Công cụ migration

Tạo script trong backend với các mode:

- `--dry-run`
- `--apply`
- `--resume`
- `--verify`
- `--reconcile`

Các cơ chế an toàn:

- Bắt buộc `--confirm-source-project=e-commerce-72a4b`.
- Bắt buộc `--confirm-target-project=jw-system-f2104`.
- Từ chối apply nếu target không rỗng và không có migration ID hợp lệ.
- Đọc theo document ID cursor, không nạp toàn bộ vào RAM.
- Ghi chunk có checkpoint.
- Có canonical hash để chạy lại không tạo bản sao.
- Báo cáo count và checksum nguồn/đích.

Do dữ liệu nguồn thiếu `updatedAt` đồng nhất, trước bulk migration cần bổ sung tạm thời change marker cho mọi mutation voucher ở hệ thống cũ. Quy trình:

1. Deploy change marker lên e-commerce.
2. Chạy initial bulk copy khi hệ thống vẫn hoạt động.
3. Chạy delta từ change marker.
4. Mở maintenance window ngắn, khóa write voucher cũ.
5. Chạy delta cuối và full reconciliation.
6. Chuyển JPULSE thành hệ thống ghi chính.

Nếu các chức năng event/redeem cũ vẫn tiếp tục chạy sau cutover thì bắt buộc có cầu nối đồng bộ tạm thời; nếu không, dữ liệu sẽ phân kỳ.

## 10. Cấu trúc triển khai

Backend tuân thủ Controller → Service → Repository:

```text
apps/be-wms/src/
├─ api/routes/marketingVoucherRoutes.ts
├─ api/controllers/marketingVoucherCampaignController.ts
├─ api/controllers/marketingVoucherCodeController.ts
├─ api/controllers/marketingVoucherJobController.ts
├─ repositories/marketingVoucherCampaignRepository.ts
├─ repositories/marketingVoucherCodeRepository.ts
├─ repositories/marketingVoucherJobRepository.ts
├─ services/marketingVoucherCampaignService.ts
├─ services/marketingVoucherCodeGenerationService.ts
├─ services/marketingVoucherExportService.ts
├─ services/marketingVoucherEmailService.ts
└─ scripts/migrateMarketingVouchers.ts
```

Frontend:

```text
apps/fe-wms/src/
├─ app/(dashboard)/admin/vouchers/page.tsx
├─ app/(dashboard)/admin/vouchers/loading.tsx
├─ app/(dashboard)/admin/vouchers/error.tsx
├─ components/features/marketing-vouchers/
├─ hooks/useMarketingVoucher*.ts
├─ utils/marketingVoucher*.ts
└─ lib/i18n/{vi,zh}.ts
```

Không sao chép các Next.js 16 Route Handler từ e-commerce sang JPULSE. JPULSE dùng Next.js 15.5 cho frontend và Express cho business API.

## 11. Các phase thực hiện

### Phase 0 — Baseline và ADR

- [x] Khảo sát hai codebase và dữ liệu production.
- [x] Chốt phạm vi và semantics.
- [ ] Viết ADR domain, collection naming, trạng thái và job model.
- [ ] Chốt source commit và migration manifest.

### Phase 1 — Shared types, RBAC và security

- [x] Tạo shared types/schema.
- [x] Đăng ký 8 permission.
- [x] Bổ sung menu `/admin/vouchers`.
- [x] Firestore Rules và indexes.
- [x] Unit test access matrix và Rules emulator.

### Phase 2 — Backend core

- [x] Campaign CRUD.
- [x] Pause/resume guard.
- [x] Code query/filter/pagination.
- [x] Revoke đơn/hàng loạt.
- [x] Gia hạn.
- [x] Counter transaction và audit.
- [x] Generation job có resume/idempotency.

### Phase 3 — Frontend quản trị

- [x] Dashboard realtime.
- [x] Campaign list/create/edit.
- [x] Kho mã và bulk action.
- [x] Job progress.
- [x] Mobile-native UI, skeleton, i18n, Gooey Toast.

### Phase 4 — Màu voucher và email Brevo

- [x] Fixed voucher renderer.
- [x] Chọn một màu và preview.
- [x] Luồng email ba bước.
- [x] Mở rộng Brevo attachments.
- [x] Email jobs, results và retry failed.

### Phase 5 — Excel job

- [x] Workbook có QR.
- [x] Chia file/ZIP.
- [x] Storage, signed URL và manifest.
- [x] Resume/retry và kiểm tra paused.

### Phase 6 — Migration rehearsal

- [ ] Dry-run production source.
- [ ] Copy sang Firebase test.
- [ ] Đối soát 14 campaign và 1.428.254 code.
- [ ] Kiểm tra ảnh/checksum.
- [ ] UAT trên dữ liệu thật đã ẩn PII khi cần.

### Phase 7 — Production cutover

- [ ] Deploy backend/rules/indexes trước, route tắt bằng feature flag.
- [ ] Initial bulk migration.
- [ ] Delta migration.
- [ ] Maintenance window và final reconcile.
- [ ] Bật route/permission.
- [ ] Theo dõi job, Brevo, Firestore reads/writes và Cloud Run.

### Phase 8 — Ổn định và rollback window

- [ ] Giữ hệ thống cũ read-only tối thiểu 30 ngày.
- [ ] Theo dõi audit và reconciliation hằng ngày.
- [ ] Có script reverse-delta nếu phải rollback.
- [ ] Email đã gửi không thể rollback; báo cáo dispatch được giữ nguyên.

Ước lượng: khoảng 25–35 ngày công cho một developer, gồm migration rehearsal và UAT.

## 12. Tiêu chí nghiệm thu bắt buộc

- Target có đúng 14 campaign và 1.428.254 mã.
- Tổng từng campaign bằng số document thực tế, không dùng số khai báo cũ.
- Không có mã trùng hoặc bị ghi đè.
- Campaign thiếu purpose được chuyển thành `EVENT`.
- 100% ảnh chuyển thành công hoặc có danh sách lỗi cụ thể.
- Pause chặn generation, export, email và contract sử dụng voucher tương lai.
- Sinh thử số lượng lớn hoàn thành đúng số yêu cầu sau khi mô phỏng lỗi/retry.
- Gia hạn chỉ tác động mã chưa dùng/chưa vô hiệu.
- Không có API mutation thiếu auth, RBAC, Zod hoặc audit.
- Excel mở được, QR quét đúng mã và tổng dòng khớp manifest.
- Email gửi qua Brevo, QR hiển thị đúng, không lặp bước thiết kế.
- Retry không gửi lại item đã thành công.
- UI Việt–Trung, light-only, responsive và không có nút refresh thủ công.
- Typecheck, lint, unit, emulator, integration và UAT đều đạt trước cutover.
