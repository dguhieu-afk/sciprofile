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

// Chỉ PGS/GS được ghi nhận là học hàm. Chức danh nghề nghiệp là thông tin riêng.
export const ACADEMIC_RANKS = ['Phó giáo sư', 'Giáo sư']
export const PROFESSIONAL_TITLES = ['Trợ giảng', 'Giảng viên', 'Giảng viên chính', 'Giảng viên cao cấp', 'Nghiên cứu viên', 'Nghiên cứu viên chính', 'Nghiên cứu viên cao cấp']
export const isAcademicRank = v => ACADEMIC_RANKS.includes(String(v || '').trim())

// Nhắc người nhập kiểm tra những mốc hiếm gặp, không tự kết luận rằng bằng cấp là giả.
export function academicWarnings({ birthDate, education = [], academicRank, rankYear, professionalYear } = {}) {
  const messages = []
  const birth = birthDate ? Number(String(birthDate).slice(0, 4)) : null
  const completed = education.filter(e => DEGREE_RANK[e.degree] && validYear(yearNumber(e.end_year)))
  if (birth && validYear(birth)) {
    for (const e of completed) {
      const age = Number(e.end_year) - birth
      if (age < 18) messages.push(`Bằng ${e.degree} năm ${e.end_year} được cấp khi khoảng ${age} tuổi; vui lòng kiểm tra hồ sơ gốc.`)
    }
    if (rankYear && Number(rankYear) - birth < 25) messages.push(`Năm công nhận ${academicRank} (${rankYear}) cần đối chiếu quyết định và ngày sinh.`)
    if (professionalYear && Number(professionalYear) - birth < 18) messages.push(`Năm bổ nhiệm chức danh nghề nghiệp ${professionalYear} cần được kiểm tra.`)
  }
  const phd = completed.filter(e => DEGREE_RANK[e.degree] >= 3).sort((a,b)=>Number(a.end_year)-Number(b.end_year))[0]
  if (isAcademicRank(academicRank) && phd && rankYear && Number(rankYear) < Number(phd.end_year))
    messages.push(`Năm công nhận ${academicRank} (${rankYear}) sớm hơn năm cấp bằng ${phd.degree} (${phd.end_year}); cần kiểm tra lại.`)
  if (isAcademicRank(academicRank) && !phd) messages.push('Đã khai học hàm PGS/GS nhưng chưa có văn bằng Tiến sĩ trong quá trình đào tạo; vui lòng bổ sung minh chứng.')
  return [...new Set(messages)]
}
