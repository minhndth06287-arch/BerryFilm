# Chạy BerryFilm trên Appetize.io (không cần cài Android Studio)

Máy yếu thì mình không build APK trên máy — để **GitHub build hộ miễn phí** trên "máy ảo trên mây", bạn chỉ cần tải file `.apk` về rồi đưa lên Appetize.io.

## Bước 1: Tạo tài khoản GitHub (nếu chưa có)
https://github.com/signup

## Bước 2: Tạo repository mới
1. Vào https://github.com/new
2. Đặt tên bất kỳ, ví dụ `berryfilm-app`
3. Để **Public** (repo private cũng được nhưng cần bật Actions)
4. Bấm **Create repository**

## Bước 3: Tải code lên GitHub
Cách dễ nhất — không cần dùng lệnh `git`:
1. Giải nén file zip BerryFilm mới nhất ra một thư mục
2. Vào trang repo vừa tạo trên GitHub, bấm **"uploading an existing file"**
3. Kéo thả **toàn bộ nội dung bên trong thư mục** (index.html, js/, styles/, package.json, capacitor.config.json, android/, .github/...) vào khung upload
   - Lưu ý: thư mục `.github` chứa file cấu hình quan trọng (`build-apk.yml`) — nếu web GitHub không cho kéo thả thư mục ẩn `.github`, dùng cách ở phần "Cách thay thế" bên dưới.
4. Bấm **Commit changes**

### Cách thay thế (nếu kéo-thả bị thiếu thư mục .github) — dùng Git:
```
cd duong-dan-toi-thu-muc-BerryFilm
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/TEN-BAN/berryfilm-app.git
git push -u origin main
```
(thay `TEN-BAN` bằng username GitHub của bạn)

## Bước 4: Đợi GitHub tự build APK
1. Vào tab **Actions** trên trang repo
2. Sẽ thấy một job tên **"Build Android APK"** đang chạy (mất khoảng 3-5 phút)
3. Đợi tới khi thấy dấu ✅ màu xanh

## Bước 5: Tải file APK về máy
1. Bấm vào job vừa chạy xong (dấu ✅)
2. Kéo xuống mục **Artifacts**, bấm tải file **BerryFilm-debug-apk**
3. Giải nén ra sẽ được file `app-debug.apk`

## Bước 6: Chạy thử trên Appetize.io
1. Vào https://appetize.io
2. Bấm **"Upload your app"** (không cần tài khoản để test nhanh, nhưng có tài khoản free sẽ lưu lại link)
3. Kéo thả file `app-debug.apk` vào
4. Chọn thiết bị Android muốn giả lập (ví dụ Pixel 7)
5. Bấm **Play/Start** — máy ảo Android sẽ chạy ngay trên trình duyệt, cài sẵn app BerryFilm

## Lưu ý quan trọng về Camera
- Máy ảo trên Appetize.io **không có webcam thật** để truyền hình ảnh vào, nên phần preview camera sống có thể không hiển thị được (đây là giới hạn của máy ảo cloud, không phải lỗi app).
- Muốn test đầy đủ tính năng camera thật, cần cài file `.apk` này lên **điện thoại Android thật** (copy file `app-debug.apk` vào điện thoại, bật "Cài từ nguồn không xác định" trong Settings, rồi cài).
- Appetize.io vẫn hữu ích để xem giao diện, nút bấm, layout, animation có đúng như mong muốn không.
