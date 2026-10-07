// Viết hoa chữ cái đầu mỗi từ khi đang gõ (giữ nguyên dấu cách cuối)
export const liveCap = s =>
  s.replace(/(^|\s)(\S)/gu, (_, a, b) => a + b.toLocaleUpperCase('vi'))

// Chuẩn hóa hoàn toàn khi lưu: "nGUYEN  trung hieu" -> "Nguyen Trung Hieu"
export const titleCase = s =>
  s.trim().replace(/\s+/g, ' ').toLowerCase().split(' ')
    .map(w => w.charAt(0).toLocaleUpperCase('vi') + w.slice(1)).join(' ')