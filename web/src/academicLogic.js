// Logic chung cho hồ sơ, CV web và CV Word.
// Học hàm (PGS/GS) là quyết định bổ nhiệm, không tự suy từ bằng cấp.
export const DEGREE_RANK = { 'Cử nhân': 1, 'Kỹ sư': 1, 'Thạc sĩ': 2, 'Tiến sĩ': 3, 'Tiến sĩ khoa học': 4 }
export const COMPLETED_DEGREES = Object.keys(DEGREE_RANK)
export const yearNumber = value => value === '' || value == null ? null : Number(value)
const validYear = y => Number.isInteger(y) && y >= 1900 && y <= new Date().getFullYear()

export function sortEducation(items = []) {
  return [...items].sort((a, b) => (Number(a.end_year || a.start_year || 9999) - Number(b.end_year || b.start_year || 9999)) ||
    ((DEGREE_RANK[a.degree] || 10) - (DEGREE_RANK[b.degree] || 10)) ||
    Number(a.start_year || 0) - Number(b.start_year || 0))
}
export function highestCompletedDegree(items = []) {
  return [...items].filter(i => DEGREE_RANK[i.degree] && validYear(yearNumber(i.end_year)))
    .sort((a,b) => (DEGREE_RANK[b.degree] - DEGREE_RANK[a.degree]) || (Number(b.end_year) - Number(a.end_year)))[0] || null
}
// Dùng khi thêm mới và kiểm tra cả các bản ghi trước đây.
export function validateEducation(items = []) {
  for (const e of items) {
    const start = yearNumber(e.start_year), end = yearNumber(e.end_year)
    if (start != null && !validYear(start)) return 'Năm bắt đầu đào tạo không hợp lệ.'
    if (end != null && !validYear(end)) return 'Năm tốt nghiệp/cấp bằng không hợp lệ hoặc nằm trong tương lai.'
    if (start != null && end != null && start > end) return `Bậc ${e.degree || 'đào tạo'}: năm bắt đầu phải không lớn hơn năm kết thúc.`
    if (DEGREE_RANK[e.degree] && end == null) return `Bậc ${e.degree} cần có năm cấp bằng để xác định học vị.`
    if (e.degree === 'Thực tập sau tiến sĩ' && start == null) return 'Thực tập sau tiến sĩ cần năm bắt đầu.'
  }
  const degrees = items.filter(e => DEGREE_RANK[e.degree] && validYear(yearNumber(e.end_year)))
  for (const higher of degrees) for (const lower of degrees) {
    if (DEGREE_RANK[higher.degree] > DEGREE_RANK[lower.degree] && Number(higher.end_year) < Number(lower.end_year))
      return `Thứ tự cấp bằng không hợp lý: ${higher.degree} (${higher.end_year}) trước ${lower.degree} (${lower.end_year}). Vui lòng kiểm tra lại.`
  }
  const phdYears = degrees.filter(e => DEGREE_RANK[e.degree] >= 3).map(e => Number(e.end_year))
  for (const e of items.filter(x => x.degree === 'Thực tập sau tiến sĩ')) {
    if (phdYears.length && Number(e.start_year) < Math.min(...phdYears)) return 'Thực tập sau tiến sĩ không thể bắt đầu trước khi nhận bằng Tiến sĩ.'
  }
  return ''
}
