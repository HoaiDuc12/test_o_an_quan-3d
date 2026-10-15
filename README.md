# SÂN ĐÌNH TUỔI THƠ — V2 (Playable web game hub)

**Trò chơi dân gian Việt Nam • Responsive web/PWA • WebSocket • Ô Ăn Quan 2 người online • Mini games**

Đây là phiên bản phát triển tiếp từ Ô Ăn Quan 3D V3 và prototype UI/UX Sân Đình Tuổi Thơ. **Không phải game AAA hoàn chỉnh.**

## Có gì chơi được?

| Trò | Trạng thái | Chơi ở đâu |
|---|---|---|
| Ô Ăn Quan | Chơi được | Hai người online bằng mã phòng/URL; hoặc solo với bot |
| Caro học trò | Chơi được | Hai người lần lượt trên **cùng** thiết bị, 10×10, thắng 5 dấu liên tiếp |
| Oẳn tù tì | Chơi được | Chơi với máy, đếm điểm |
| Cờ Gánh, Lò Cò, Chơi Chuyền, Banh Đũa, Đố vui, Bịt mắt bắt dê, Rồng rắn lên mây | **Chưa chơi được** | Thẻ giới thiệu “Đang phát triển” |

Với Ô Ăn Quan: giao diện mặc định là **bàn 2.5D tối ưu mobile**; bấm **Xem 3D** để tải renderer Three.js tùy chọn, có xoay/zoom bàn bằng ngón tay. Sỏi có số đếm trên **mọi ô**; rải quân từng viên và hiệu ứng âm thanh tổng hợp. Không có rigid-body physics Rapier hoặc tài nguyên PBR chất lượng sản xuất ở V2.

## Chạy ở máy tính

Cần Node.js 20+ và kết nối Internet để chạy `npm install` (dependency `ws`) và khi tải chế độ 3D (Three.js CDN).

```bash
npm install
npm test
npm start
```

Truy cập `http://localhost:3000`. Không mở `public/index.html` bằng `file://` nếu muốn tạo phòng/chơi qua mạng: WebSocket server cần chạy Node.js.

## Cập nhật website đã có trên Render

Nếu trước đó anh đã deploy **https://o-an-quan-3d.onrender.com** từ một repo GitHub, làm theo hướng **cập nhật repo cũ** để giữ nguyên URL:

1. Giải nén ZIP. Vào thư mục `san-dinh-tuoi-tho-v2/` (chứa `server.js`, `rules.js`, `package.json`, `public/`).
2. Thay các file cũ ở **thư mục gốc** repo GitHub đã kết nối Render bằng nội dung thư mục này, rồi `git add . && git commit -m "Sân Đình Tuổi Thơ V2" && git push`.
3. Trên Render, vào **service cũ** (ví dụ `o-an-quan-3d`) -> **Events**. Nếu chưa auto-deploy thì chọn **Manual Deploy -> Deploy latest commit**.
4. Kiểm tra **Settings**: Build command `npm install`, Start command `npm start`, Health check path `/health`. Render sẽ cấp `PORT`, server tự sử dụng biến này và lắng nghe `0.0.0.0`.
5. Sau deploy, mở site trên laptop và điện thoại bằng **HTTPS**. Thiết bị A tạo phòng 2 người và nhấn **Sao chép** để gửi URL. Thiết bị B mở liên kết, sẽ vào cùng bàn chơi.

**Lưu ý**: `render.yaml` giữ `name: o-an-quan-3d`. Nếu bạn đã sử dụng Blueprint gắn với service khác tên, hãy kiểm tra cấu hình trước khi áp dụng Blueprint để tránh tạo một service thứ hai. Với service cũ deploy trực tiếp từ repo, chỉ cần push code, không cần tạo Blueprint mới.

Nếu trình duyệt còn giữ UI cũ sau deploy: thử Ctrl+Shift+R, hoặc mở trong tab ẩn danh để kiểm tra phiên bản mới. Service worker cũ sẽ được thay khi trình duyệt cập nhật SW.

## Test 2 thiết bị thật

1. Laptop vào website -> **Phòng bạn bè -> Tạo phòng 2 người**.
2. Điện thoại mở đường dẫn được laptop sao chép -> xem phía điện thoại hiện **Người chơi 2** (phía laptop là **Người chơi 1**).
3. Trên laptop chọn một ô Dân **hàng dưới** còn quân -> chọn `Rải thuận vòng` hoặc `Rải ngược vòng`.
4. Xác nhận điện thoại cập nhật **cùng số quân, lượt và điểm**. Sau đó đi nước hợp lệ với hàng trên của điện thoại.
5. Đóng tab điện thoại, mở lại cùng tab / trình duyệt để thử tự kết nối lại. Với tab ẩn danh mới không có token cũ, không thể chiếm lại ghế đã đặt trước.

## Cấu trúc

```text
san-dinh-tuoi-tho-v2/
├── server.js          # HTTP static server + WebSocket authoritative + rooms + solo bot
├── rules.js           # Bộ luật Ô Ăn Quan, tính điểm, ăn quân, cháy quân
├── package.json
├── render.yaml        # Render Node Web Service
├── test/rules.test.js # 5 bài test luật
└── public/
    ├── index.html     # Home, Library, Lobby, Game, Profile, RPS, Caro
    ├── style.css      # Responsive design system + 2.5D board
    ├── app.js         # Router, game UI, WS protocol, animation event queue, mini games
    ├── three-mode.js  # Three.js scene optional, instanced stones, click picking
    ├── icon.svg
    ├── manifest.webmanifest
    └── sw.js
```

## Luật Ô Ăn Quan và multiplayer

`rules.js` là nguồn sự thật, server chỉ nhận `{type:'move',pit,dir,seq}`; không cho client tự gửi điểm/sửa bàn cờ. Các ô `[0..4]` là phía người 1; `[6..10]` người 2; `[5,11]` là Quan. Mỗi Quan trị giá 10 điểm. Bốc/rải tiếp theo chuỗi Dân, ăn quân qua ô trống, và luật cháy quân (bổ sung 5 quân, trừ/ghi nợ 5 điểm) theo biến thể đã ghi trong mã nguồn. Biến thể vùng miền có thể khác nhau.

Phòng: mã 6 ký tự, token khôi phục bí mật lưu trong localStorage thiết bị; gửi lời mời qua URL `?room=ABC123`. Đối thủ vào ghế trống; ghế đã được nhận chỉ khôi phục bằng token. Nếu một người **Rời phòng**, server mở ghế và đưa bàn cờ về trạng thái mới. Solo tạo bot server, khi đến lượt bot sẽ ưu tiên những nước có thể ăn quân.

### Giới hạn quan trọng

- Phòng **lưu RAM của một process**, restart/redeploy/autosleep Render có thể mất phòng, ván, token; chưa có Redis hoặc DB.
- Service miễn phí có thời gian khởi động lần đầu, chưa bảo đảm độ trễ thấp, không dùng để tổ chức giải có thưởng hoặc tải lớn.
- Chưa có tài khoản đăng nhập/đồng bộ hồ sơ. Tên và thống kê đang lưu trong localStorage; không đồng bộ giữa các thiết bị.
- 3D dùng Three.js CDN, yêu cầu mạng và WebGL; máy yếu nên dùng 2.5D mặc định. Motion là tween đồ họa, **chưa có vật lý va chạm/sỏi 3D thực**.
- Chưa có kiểm thử tự động end-to-end 2 thiết bị với Node WebSocket server trên môi trường Render; cần chạy bài test 2 thiết bị thực phía trên.
- Chín thẻ trò còn lại chỉ là roadmap; **Caro là local 2 người, không phải multiplayer online**.

## Các kiểm tra đã thực hiện khi tạo V2

- `node --check` cho `server.js`, `public/app.js`, `public/three-mode.js`.
- `node --test`: 5/5 unit test thuật toán Ô Ăn Quan đạt.
- Headless Chromium ở ba viewport: desktop 1440×940, mobile 390×844, ngang 844×390: không lỗi JS trong các tương tác Home/Library/Caro/Oẳn tù tì, không tràn ngang.
- Mô phỏng server WebSocket ở frontend: tạo phòng bot, chọn ô, rải quân, cập nhật điểm và quân sau sự kiện hoàn tất.
- **Chưa chạy kiểm thử server WebSocket thực tế ở môi trường này do không tải được gói npm `ws`**, mặc dù gói đã khai báo trong `package.json` và Render có thể cài từ npm.
