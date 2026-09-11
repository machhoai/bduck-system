# Kế hoạch triển khai đổi voucher trên JPOS

Ngày khảo sát: 10/09/2026. Phạm vi: `D:/Github/bduck-system` và `D:/Github/POS`.

Trạng thái: đã triển khai lõi ngày 11/09/2026 trong cả J-PULSE và JPOS. Unit test, Firestore emulator, lint, typecheck và build production JPOS đã đạt; còn UAT scanner/máy in trên thiết bị cửa hàng và chính sách hoàn voucher trước khi phát hành rộng. Đã xác nhận: voucher do J-PULSE phát hành; JPOS cần mạng; voucher gắn sản phẩm cố định; giảm phần trăm trên toàn bộ đơn; tối đa một voucher phần trăm mỗi đơn; voucher vé/quà không giới hạn số mã theo nghiệp vụ.

## 1. Kết quả khảo sát và ràng buộc

- Đã đọc `.agent/rules/rules.md` của J-PULSE, `.agent/rules/project-rules/rules.md` và quy tắc namespace database của JPOS, AGENTS.md, hướng dẫn frontend/brand của hai dự án, cùng types liên quan trong `packages/shared-types/src/` và `POS/src/lib/types/`.
- Không tìm thấy skill `brainstorming`/`brainstorm` trong các thư mục skill dự án và runtime đã kiểm tra. Không thể tuyên bố đã gọi các skill đó; bước làm rõ nghiệp vụ được thực hiện bằng câu hỏi trực tiếp. `frontend-expert` có ví dụ MUI/TanStack Router/snackbar, nhưng quy tắc riêng của dự án được ưu tiên: Next.js, Tailwind, Zustand và goey-toast.
- JPOS thực tế khai báo Next.js 16.2.4 trong package.json, khác mô tả Next.js 14 trong rules. Đã đọc hướng dẫn static export trong `POS/node_modules/next/dist/docs/01-app/02-guides/static-exports.md`; route mới phải tương thích Tauri/static export.
- Hai dự án dùng chung Firestore. Dữ liệu riêng POS mới phải có tiền tố `pos_`. `jpos_products` là ngoại lệ legacy đang được dùng; không đổi collection này trong tính năng voucher. Không deploy riêng ruleset POS đè rules dùng chung.
- `MarketingVoucherCampaign` có reward type, giá trị, thời hạn, trạng thái và revision; chưa có mapping sản phẩm hay phạm vi cửa hàng. `MarketingVoucherCode` đã có AVAILABLE, DISTRIBUTED, USED, REVOKED và thông tin người sử dụng, nhưng chưa có liên kết đầy đủ với đơn/cửa hàng/thiết bị đổi.
- `/pos-management` đã chọn cửa hàng theo `warehouse_id`, quản lý sản phẩm được bán, mẫu bill/vé và phân quyền; đây là điểm tích hợp phù hợp.
- `POS/src/components/pos/CartPanel.tsx` đang báo chưa có API áp dụng voucher. `VoucherInput.tsx` có ô nhập hỗ trợ Enter, nhưng camera là TODO. Do đó luồng voucher cần bổ sung cả backend, không chỉ thay UI.
- `useCartStore` đang gộp dòng theo `goodsId`. Phải xử lý riêng định danh dòng và phân bổ voucher để không gộp hàng đổi miễn phí với hàng mua cùng mã.
- Backend JPOS tạo và lưu `ticketCodes` trên từng dòng hàng. Có sẵn `buildPrintableTickets`, `printTicketsSilently` và dịch vụ in trực tiếp Tauri để tái sử dụng.
- Không thấy tài liệu tên chính xác `OpenApi.md`; đã đối chiếu `海外-鲸舰-OpenApi_EN.md`. Có `writeoff_prepare` cho coupon group purchase bên thứ ba, nhưng chưa có bằng chứng endpoint này nhận voucher marketing của J-PULSE. API order hiện tại không có input voucher J-PULSE; adapter `order_pay` gửi `PayAmount: null`, tức thanh toán đầy đủ đơn Hong Kong.

**Điều kiện triển khai:** theo quy tắc API của JPOS, phải bổ sung/chốt contract còn thiếu trước khi code tích hợp voucher. Không tự chế endpoint Hong Kong hay coi tham số PayAmount là API giảm giá. Việc mô tả API mới dưới đây là kế hoạch xây dựng, không khẳng định API đã tồn tại.

## 2. Đề xuất giao diện và phạm vi bản đầu

Đã chọn mô hình kết hợp: trang `Đổi voucher` dành cho quầy xử lý liên tục tại route tĩnh `/voucher-redemption`, đồng thời tích hợp ô áp dụng voucher và scanner toàn cục vào màn hình bán hàng. Cả hai dùng cùng API kiểm tra và mapping; trang chuyên dụng tối ưu thao tác đổi vé/quà liên tục, còn màn hình bán hàng xử lý voucher giảm phần trăm hoặc đơn có mua thêm.

| Bề mặt | Mục đích | Sau khi quét | Khi in |
|---|---|---|---|
| Trang Đổi voucher | Quầy chuyên đổi, quét liên tục | Tạo giỏ/đơn đổi riêng từ mapping cố định | Tự hoàn tất và in khi không còn tiền cần thu và server xác nhận |
| Màn hình bán hàng | Đơn có mua thêm, áp dụng vào giỏ hiện tại | Tự thêm sản phẩm và ưu đãi vào giỏ | Sau khi hoàn tất thanh toán đơn |
| Chế độ Chỉ kiểm tra | Xem voucher còn dùng được hay không | Hiển thị điều kiện/kết quả | Không tạo đơn, không ghi USED, không in |

Ô voucher tiếp tục nhận nhiều mã trong cùng giỏ; scanner thử barcode sản phẩm trước, nếu không khớp thì kiểm tra voucher. Trạng thái "đã thêm vào giỏ" được phân biệt với "đã sử dụng"; mã chỉ chuyển USED khi server commit đơn.

Trang đổi gồm: thanh cửa hàng/thu ngân/máy in/kết nối; ô nhận mã tự focus; trạng thái sẵn sàng hoặc đang xử lý; thẻ kết quả với chiến dịch, sản phẩm, số lượng, ưu đãi và số tiền phải thu; danh sách giao dịch gần đây kèm trạng thái in. Dùng màu và chữ để phân biệt kết quả, có thể bổ sung âm thanh thành công/lỗi. Không chỉ dùng toast vì kết quả cần còn trên màn hình khi quét tiếp.

Phạm vi bản đầu: `FREE_TICKET`, `FREE_ITEM` và `DISCOUNT_PERCENT` của J-PULSE, gắn sản phẩm cố định. Không đưa `DISCOUNT_FIXED` và nguồn đối tác vào phạm vi chỉ vì schema hiện có hỗ trợ. Trước mắt mỗi mapping có sản phẩm và số lượng xác định; combo nhiều sản phẩm chỉ mở nếu có nhu cầu cụ thể.

| Loại voucher | Tự thêm giỏ | Tính tiền | Hoàn tất và in |
|---|---|---|---|
| Tặng vé | Đúng sản phẩm vé và số lượng mapping | Quyền lợi bù đủ phần hàng được tặng | Trang đổi có thể tự commit và in vé khi không có hàng mua thêm |
| Tặng quà | Đúng quà và số lượng mapping | Quyền lợi bù đủ phần hàng được tặng | Tự commit và in bill/phiếu đổi; vé chỉ in nếu sản phẩm thực sự có vé |
| Giảm phần trăm | Đúng sản phẩm và số lượng mapping | Giảm trên toàn bộ đơn; sau phần miễn phí của voucher vé/quà | Chuyển bước thu tiền; in khi thanh toán được xác nhận |

Ví dụ đã triển khai: voucher 20% gắn một vé giá 200.000đ tự thêm vé. Nếu khách mua thêm món 50.000đ, voucher giảm 50.000đ trên tạm tính 250.000đ và còn thu 200.000đ. Nếu có voucher tặng vé trong cùng đơn, phần vé miễn phí được trừ trước rồi mới tính phần trăm trên số tiền còn lại. Backend làm tròn đến số nguyên VND và là nguồn tính chính thức.

Tại giỏ bán hàng, kể cả voucher tặng vé, hệ thống chỉ thêm quyền lợi vào đơn đang mở; không tự chốt những món khách đang mua. Trang đổi tạo đơn riêng và tự hoàn tất/in cho voucher vé/quà. Nếu quét voucher giảm phần trăm tại trang đổi, hệ thống chỉ thông báo chuyển sang màn hình bán hàng và chưa tiêu thụ mã.

## 3. Quy tắc scanner

- Xác minh model thực tế hỗ trợ đọc QR (2D), không chỉ barcode 1D. Ưu tiên chế độ USB/Bluetooth HID Keyboard và suffix Enter khi phần cứng hỗ trợ.
- Chỉ gửi lookup khi nhận trọn mã và ký tự kết thúc; không gọi API sau mỗi ký tự. Dán mã hoặc gõ tay vẫn có đường thao tác tương đương. Nếu máy không có suffix, cần cấu hình lại hoặc khảo sát cơ chế kết thúc riêng; không coi khoảng ngừng ngắn là bằng chứng chắc chắn mã đã hoàn tất.
- Đọc payload là dữ liệu. Nếu QR chứa URL, chỉ parse định dạng/host được cho phép; không tự điều hướng hoặc gọi URL được quét. Chuẩn hóa mã theo quy tắc nguồn, không tùy tiện thay đổi mã đối tác.
- Hook nhận scan chỉ hoạt động ở bề mặt đang bật quét; tôn trọng input khác, IME và modal thanh toán. Sau xử lý trả focus về ô nhận mã trong vùng quét, không giật focus khi người dùng đang sửa trường khác.
- Xếp hàng các mã khác nhau và chống lặp cùng mã đang xử lý. Chặn quét đúp ở UI chỉ là tiện ích; backend phải bảo đảm cùng voucher không sinh hai đơn.
- Kiểm tra thực tế trường hợp Enter/CRLF kép, quét nhanh liên tiếp, QR trên điện thoại, mất focus và nhiều loại bàn phím. Không mở rộng camera trong bản đầu nếu không có nhu cầu.

Tham khảo phần cứng: [Zebra HID Keyboard](https://docs.zebra.com/us/en/tablets/et5-series/et51-56-prg/c-et51-56-data-capture/t-usb-connecting-a-usb-scanner-using-hid.html), [suffix Enter](https://docs.zebra.com/us/en/scanners/general/sm72-ig/user-preferences-and-miscellaneous-options/miscellaneous-scanner-parameters/enter-key.html). Đây là ví dụ về giao thức; khả năng của máy tại cửa hàng cần kiểm thử theo model.

## 4. Cấu hình tại /pos-management

Thêm tab `Voucher` cạnh các tab hiện có, giữ cửa hàng đang chọn làm ngữ cảnh. Có hai góc nhìn: danh sách chiến dịch áp dụng tại cửa hàng và cấu hình phạm vi của một chiến dịch. Người chỉ có quyền một cửa hàng không được sửa chính sách toàn hệ thống.

Một cấu hình gồm: chiến dịch, bật/tắt nhận trên JPOS, chế độ phạm vi, mapping sản phẩm, chế độ hoàn tất, kiểu tài liệu in và phiên bản. Mapping chọn từ catalog bán hàng JPOS bằng `goodsId`, không dùng SKU của kho WMS hoặc tên sản phẩm làm khóa.

Phạm vi được biểu diễn bằng một setting rõ ràng cho từng cặp cửa hàng–chiến dịch. Cửa hàng chưa có setting bật mặc định không được sử dụng voucher. Cách này giữ phân quyền theo cửa hàng: người quản lý một cửa hàng không thể thay đổi phạm vi của cửa hàng khác.

Khuyến nghị an toàn vận hành: chiến dịch cũ chưa có cấu hình JPOS mặc định chưa được đổi. Quyền của nhân viên, trạng thái thiết bị, chiến dịch, phạm vi cửa hàng và tình trạng bán sản phẩm đều phải hợp lệ; một điều kiện từ chối đủ để chặn. Override sản phẩm theo cửa hàng chỉ đổi mapping, không được vượt phạm vi chiến dịch.

Mỗi mapping có `goods_id` và số lượng; có mapping mặc định và override cửa hàng nếu cần. Phần trăm giảm lấy từ `reward_value` của chiến dịch, không cho sửa thêm một mức phần trăm độc lập ở trang POS. Phân biệt số đơn vị sản phẩm với `ticketsPerUnit`: một voucher đổi một gói có thể in nhiều vé theo cấu hình gói.

Khi lưu, backend kiểm tra sản phẩm tồn tại và có thể bán tại các cửa hàng liên quan. Hiển thị cảnh báo cụ thể khi sản phẩm bị ngừng bán; không lặng lẽ thay sản phẩm. Có vùng thử mã chỉ kiểm tra, hiển thị sản phẩm sẽ thêm và lý do được/chặn, không tiêu thụ voucher.

## 5. Dữ liệu và phân chia trách nhiệm

Tên dưới đây là đề xuất cần kiểm tra xung đột collection và chốt owner trước khi code.

| Dữ liệu | Owner và nội dung |
|---|---|
| `marketing_voucher_campaigns`, `marketing_voucher_codes` | J-PULSE giữ schema nguồn, không nhân bản toàn bộ mã sang POS |
| `pos_voucher_campaign_settings` | Schema do J-PULSE quản lý trong shared-types; chứa campaign ID, enabled, phạm vi, mapping mặc định/override, chính sách in, revision, soft delete, metadata |
| `pos_voucher_redemptions` | POS quản lý giao dịch đổi: voucher/campaign/order, cửa hàng, thiết bị, thu ngân, request ID, trạng thái, mapping revision, amount snapshot, action_time/sync_time |
| `pos_orders` | Bổ sung liên kết voucher vào dòng hàng, số tiền ưu đãi, tiền cần thu, nguồn chi trả; giữ mã vé đã cấp và thông tin hoàn/hủy |
| `audit_logs` | Contract dùng chung có kiểm soát; cấu hình và giao dịch đổi đều ghi người thực hiện, trước/sau, hai mốc thời gian |
| Nhật ký in bền vững | Lưu theo đơn/tài liệu/thiết bị để phục hồi sau restart; nếu có collection riêng thì dùng tiền tố `pos_` |

J-PULSE frontend chỉ quản trị qua API; backend theo Controller → Service → Repository, Zod, JWT/RBAC, audit và optimistic concurrency. JPOS gọi qua services, state trong Zustand, nghiệp vụ quyền lợi và mọi API Hong Kong nằm trong `functions/`.

Do hai backend cùng truy cập một Firestore, chốt contract cho Cloud Functions được cập nhật những field nào của voucher J-PULSE. Logic đổi và commit đơn có một chủ thể thực thi duy nhất phía server, đọc lại voucher/chính sách ngay trong transaction. Không làm hai request độc lập kiểu đánh USED trước rồi tạo đơn sau.

Shared types của J-PULSE là nguồn contract. Hai repo phải dùng package/version hoặc contract đồng bộ có kiểm tra tương thích; không import file xuyên repo hay giữa frontend và functions. Có adapter rõ cho Date/Firestore Timestamp/ISO string và `goods_id`/`goodsId`.

## 6. Luồng đổi và tính nhất quán

1. Scanner phát một mã hoàn chỉnh. UI tạo request ID bền vững cho thao tác và đưa vào hàng xử lý.
2. Server kiểm tra user/device/cửa hàng, mã và chiến dịch đang ACTIVE, ngày bắt đầu/kết thúc, AVAILABLE hoặc DISTRIBUTED theo chính sách đã chốt, chưa thu hồi/xóa/sử dụng, mapping và sản phẩm được bán. Dùng giờ server và múi giờ nghiệp vụ, không tin đồng hồ máy POS.
3. Trả kết quả có cấu trúc: mã lỗi, sản phẩm, số lượng, ưu đãi, số tiền còn phải thu, revision chính sách. Frontend thêm đủ các dòng bằng một action của store; lỗi một dòng thì không thêm dở combo.
4. Chế độ kiểm tra kết thúc ở đây. Chế độ giỏ hàng đánh dấu đã áp dụng, chưa USED. Thêm hàng phải vô hiệu hóa hoặc tạo lại báo giá/đơn nháp cũ; giỏ đã khóa do PayOS không được sửa.
5. Khi xác nhận đổi miễn phí hoặc thanh toán xong, server kiểm tra lại và trong một Firestore transaction commit voucher USED, liên kết giao dịch đổi, đơn/ưu đãi/trạng thái thanh toán, các mã vé và audit. Nếu counters chiến dịch thay đổi thì cũng cập nhật nguyên tử.
6. Chỉ sau commit thành công mới phát lệnh in bằng dữ liệu đã lưu của đơn. Dùng mã vé đã cấp; retry không tạo mã vé mới. Background đồng bộ Hong Kong chỉ chạy theo chính sách tích hợp được chốt.

Mã request giống nhau và nội dung giống nhau trả lại cùng kết quả; cùng request nhưng khác nội dung bị từ chối. Mã voucher giống nhau với request khác kiểm tra giao dịch đã tồn tại, không tạo thêm đơn. Trường hợp request timeout sau commit phải truy vấn trạng thái theo request/order trước khi thử lại.

Đơn có phần cần thanh toán thêm cần reservation server cho voucher trước khi tạo yêu cầu thanh toán, tránh nhận tiền rồi phát hiện mã vừa bị dùng ở quầy khác. Reservation có trạng thái riêng, owner, hạn giữ và luồng giải phóng khi hủy; không tùy tiện sửa enum trạng thái voucher công khai. Hạn giữ phải phối hợp với trạng thái payment, không giải phóng chỉ vì hết giờ khi vẫn có khả năng callback thanh toán đến muộn. Phải có xử lý tiền đã thu nhưng commit chưa hoàn tất và test webhook đến muộn. Đây là phần phức tạp hơn, nên triển khai sau luồng đổi trọn gói nếu chưa cần ngay.

Không thể đặt API payment/Hong Kong hay máy in vào một transaction Firestore. Các bước ngoài DB cần trạng thái, retry và phục hồi riêng. Không khẳng định toàn bộ luồng từ quét đến giấy in là một giao dịch nguyên tử.

## 7. Giá, vé, in và offline

- Lưu giá gốc, ưu đãi áp dụng, tiền cần thu và cách phân bổ từng dòng cho voucher tặng sản phẩm hoặc giảm %. Không chỉ sửa tổng tiền hiển thị và không tự gán mọi giao dịch đổi thành CASH 0đ. Cập nhật báo cáo/biên nhận theo dữ liệu đã chốt phía server.
- Phải chốt cách phản ánh voucher trong đơn Hong Kong: contract ưu đãi, sản phẩm đổi chuyên dụng, hoặc cơ chế khác được xác minh. Không mặc định `PayAmount=0` có nghĩa giảm 100%; không đưa đơn voucher vào worker thanh toán đầy đủ hiện tại khi chưa có contract đúng.
- Bill và vé là hai đầu ra riêng: có cấu hình vé, bill hoặc cả hai. Với hàng không phát vé, in bill/phiếu giao hàng theo loại sản phẩm. Dữ liệu in dựa trên snapshot đơn đã commit, không dựa vào mapping hiện tại.
- Dịch vụ in tuần tự theo máy để tránh các tài liệu dùng chung vùng render gây lẫn nội dung. Tách helper in hiện có khỏi Button khi cần cho automatic flow, tái sử dụng template và service Tauri.
- Trạng thái `chờ in`, `đã gửi máy in`, `lỗi in`, `không rõ kết quả` phải khác trạng thái đã đổi. Driver nhận job chưa chứng minh giấy đã ra. Timeout không tự phát lại vô hạn; in lại chủ động có quyền/audit và giữ nguyên mã vé. Nếu cần tái cấp mã mới phải là nghiệp vụ riêng có vô hiệu mã cũ.
- Máy in lỗi sau commit: voucher vẫn đã dùng; hiển thị giao dịch và nút in lại, không hoàn voucher và không thu lại tiền. Xem xét tắt fallback sang máy in mặc định ở quầy đổi nếu in nhầm quầy là không chấp nhận được.
- Đã chốt phải có mạng. Khi offline, khóa bắt đầu giao dịch đổi/checkout mới và hiển thị trạng thái; không lưu yêu cầu đổi để tự chạy âm thầm khi có mạng trở lại. Giữ journal các thao tác đang dở để đối soát khi kết nối phục hồi. Với request có thể đã commit trước lúc rớt mạng, truy vấn lại cùng request ID; không coi mất mạng là bằng chứng giao dịch thất bại.
- Local-first được dùng cho phản hồi UI, catalog và phục hồi; không có chế độ tiêu thụ voucher offline. In lại hoặc tiếp tục job của đơn đã commit là phục hồi giao dịch cũ, cần chốt chính sách vận hành riêng nếu mất mạng giữa lúc in.

## 8. Task list và thứ tự thực hiện

- [x] Đọc quy tắc, kiểm tra schema, nguồn sản phẩm, giỏ hàng, API đơn và in vé ở cả hai repo.
- [x] Đề xuất trang/modal, xác định phần API và nghiệp vụ còn thiếu.
- [x] Xác nhận nguồn J-PULSE, sản phẩm cố định, voucher tặng vé/quà và giảm %, bắt buộc online.
- [x] **P0 — Chốt nghiệp vụ và contract:** đã ghi contract tại `D:/Github/POS/docs/voucher-api.md`; còn chốt chính sách hoàn voucher và UAT model phần cứng trước rollout.
- [x] **P1 — Types, schema, quyền:** đã mở rộng shared-types/order DTO, settings/redemption schema và rules; campaign cũ mặc định chưa bật.
- [x] **P2 — J-PULSE backend và /pos-management:** đã thêm controller/service/repository, tab cấu hình theo cửa hàng, optimistic concurrency, audit, i18n vi/zh, skeleton, goey-toast và listener realtime.
- [x] **P3 — Cloud Functions đổi voucher:** đã thêm resolve, reserve/commit/release, kiểm tra server, transaction code–campaign–redemption–order và snapshot dùng khi chờ PayOS.
- [x] **P4 — JPOS trang đổi:** đã thêm `/voucher-redemption`, hàng đợi scan, chế độ chỉ kiểm tra và tự hoàn tất/in cho voucher vé/quà.
- [ ] **P5 — In và phục hồi:** gọi dịch vụ in với order đã lưu; hàng đợi in bền vững; phục hồi sau app crash; trạng thái dispatch không rõ; in lại đúng mã; kiểm tra lại khổ giấy và fallback trên máy thật.
- [x] **P6 — Modal bán hàng và voucher giảm %:** scanner toàn cục và ô voucher dùng cùng resolution engine; tự thêm sản phẩm, bảo vệ số lượng mapping, hỗ trợ nhiều mã vé/quà, một mã phần trăm, PayOS reservation/callback, bill và chi tiết đơn theo tiền sau giảm.
- [ ] **P7 — Tích hợp báo cáo, hủy và hoàn:** chi tiết đơn hiển thị quyền lợi/tiền thu; filter theo chiến dịch/cửa hàng; đối soát với Hong Kong; chốt điều kiện hoàn voucher, vô hiệu vé và chống hoàn hai lần. Không tự hoàn voucher khi chỉ lỗi in.
- [ ] **P8 — Kiểm thử và rollout:** đã đạt unit test JPOS Functions 109/109, frontend 16/16, schema 2/2, Firestore rules 23/23, lint/typecheck và build static JPOS; còn UAT Tauri/scanner/máy in, pilot một cửa hàng, theo dõi lỗi và đối soát trước khi mở rộng.

Các API mới cần mô tả ít nhất: đọc/lưu cấu hình; kiểm tra và resolve voucher; commit đổi; tra cứu trạng thái theo idempotency key; reserve/release cho giỏ thanh toán nếu hỗ trợ; lịch sử và in lại. Đây là danh mục contract dự kiến, không phải endpoint có thể gọi ở thời điểm khảo sát.

## 9. Tiêu chí nghiệm thu

| Ca kiểm thử | Kết quả bắt buộc |
|---|---|
| Quét mã hợp lệ có mapping cố định | Tự lookup và thêm đúng sản phẩm/số lượng, không bấm tìm kiếm/thêm hàng |
| Gói 1 đơn vị có nhiều vé | In theo ticketsPerUnit đã snapshot, mỗi vé một mã hợp lệ |
| Mã sai/chưa đến hạn/hết hạn/PAUSED/REVOKED/USED | Hiển thị lý do; không thêm dở giỏ, không phát sinh giao dịch thành công |
| Cửa hàng không được phép hoặc sản phẩm ngừng bán | UI và API đều chặn, kể cả request giả mạo shop ID |
| Chiến dịch/mapping đổi trong lúc đang quét | Backend kiểm tra phiên bản mới; không commit bằng policy stale; khác quyền lợi phải báo lại |
| Quét đúp, Enter kép hoặc hai quầy quét cùng mã | Chỉ một lần đổi thành công và một bộ mã vé |
| Nhiều mã khác nhau quét nhanh | Mỗi mã có kết quả; không mất scan, không lẫn đơn hoặc tài liệu in |
| Hàng mua và hàng voucher cùng goodsId | Không mất phân bổ ưu đãi do gộp dòng; tiền cần thu đúng |
| Xóa voucher/xóa hàng/clear cart | Đồng bộ liên kết dòng và quyền lợi; giải phóng reservation đúng điều kiện |
| Đơn còn tiền hoặc PayOS đang chờ | Không tự in; không sửa giỏ bị khóa; callback lặp/đến muộn xử lý đúng |
| Server commit nhưng client timeout/crash | Khôi phục cùng đơn, không dùng voucher lần hai, không tạo mã vé mới |
| Máy in hết giấy/mất kết nối/dispatch timeout | Giao dịch không bị hoàn nhầm; có trạng thái và đường in lại có kiểm soát |
| Mất mạng | Chặn giao dịch mới, không báo thành công từ cache; request dở được đối soát cùng ID khi có mạng |
| User/device sai quyền, bị thu hồi quyền | Cả frontend và backend chặn; listener không lộ toàn bộ kho mã voucher |
| API Hong Kong thất bại hoặc trả kết quả không rõ | Đơn nằm trạng thái có thể đối soát; không tự thanh toán/đổi thêm lần nữa |
| Hủy/hoàn và in lại | Quyền hạn, audit, trạng thái vé/voucher/tiền nhất quán |
| Triển khai và rollback client | Không đè rules dùng chung; không mất lịch sử; client cũ không bỏ qua voucher để tính tiền sai |

Kiểm tra chất lượng đã chạy theo scripts của từng repo: tests nghiệp vụ/emulator phù hợp, lint/typecheck/build và static export của POS. Build frontend J-PULSE đã biên dịch và sinh đủ trang nhưng bước sao chép standalone trên Windows bị chặn quyền tạo symlink (`EPERM`); typecheck và lint phần thay đổi đều đạt. Kiểm tra phần cứng vẫn phải chạy trong bản Tauri Windows vì trình duyệt không thay thế được kiểm thử in im lặng và scanner thực tế.

## 10. Các quyết định đang chờ

1. Quy tắc hoàn voucher và vô hiệu vé đã cấp khi hoàn/hủy đơn đã thanh toán.
2. Payload QR thực tế và model scanner/máy in để UAT. Không mở lại câu hỏi nguồn voucher, sản phẩm cố định, phạm vi giảm phần trăm, số voucher hay offline vì đã được xác nhận.

Các câu trả lời này có thể thay đổi phạm vi P3/P6/P7. Không xem những đề xuất trong bản kế hoạch là sự đồng ý thay người dùng.
