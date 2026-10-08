// Gợi ý lĩnh vực dựa trên tiêu đề, từ khóa và tóm tắt
const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Từ khóa nhận diện cho từng lĩnh vực (không dấu, tiếng Anh và tiếng Việt)
const RULES = {
  'tri tue nhan tao': ['artificial intelligence', 'ai', 'neural network', 'deep learning', 'machine learning', 'natural language', 'nlp', 'language model', 'reinforcement learning', 'chatbot', 'chatgpt', 'tri tue nhan tao'],
  'machine learning': ['machine learning', 'deep learning', 'neural network', 'random forest', 'support vector', 'clustering', 'classification', 'regression', 'reinforcement learning', 'hoc may', 'hoc sau'],
  'computer vision': ['computer vision', 'image recognition', 'image classification', 'object detection', 'image segmentation', 'face recognition', 'convolutional', 'thi giac may', 'nhan dang anh'],
  'an toan thong tin': ['security', 'cybersecurity', 'cyber', 'encryption', 'cryptograph', 'intrusion', 'malware', 'privacy', 'blockchain', 'an toan thong tin', 'bao mat', 'xam nhap', 'ma hoa'],
  'khoa hoc du lieu': ['data science', 'data mining', 'big data', 'data analytics', 'analytics', 'dataset', 'khai pha du lieu', 'khoa hoc du lieu', 'du lieu lon', 'phan tich du lieu'],
  'giao duc': ['education', 'e-learning', 'elearning', 'student', 'teaching', 'teacher', 'curriculum', 'pedagog', 'classroom', 'giao duc', 'hoc tap', 'sinh vien', 'giang day', 'dao tao'],
  'cong nghe thong tin': ['information technology', 'software', 'database', 'cloud computing', 'internet of things', 'iot', 'web application', 'cong nghe thong tin', 'phan mem', 'co so du lieu'],
}

const esc = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
function has(text, term) {
  const tail = term.length <= 3 ? '(?![a-z0-9])' : ''
  return new RegExp('(^|[^a-z0-9])' + esc(term) + tail).test(text)
}

// areas: [{id, name, parent_id}] -> mảng id lĩnh vực được gợi ý
export function suggestAreas(areas, { title = '', keywords = '', abstract = '' }) {
  const strong = clean(`${title} ${keywords}`)
  const full = clean(`${title} ${keywords} ${abstract}`)
  const hit = new Set()

  areas.forEach(a => {
    const key = clean(a.name).trim()
    // Lĩnh vực admin thêm mới (chưa có trong bảng trên) thì so theo chính tên của nó
    const terms = RULES[key] || (key.length > 3 ? [key] : [])
    // Từ ngắn, dễ nhầm chỉ xét trong tiêu đề và từ khóa; cụm dài xét cả tóm tắt
    const ok = terms.some(t => (t.includes(' ') || t.length > 6 ? has(full, t) : has(strong, t)))
    if (ok) hit.add(a.id)
  })
  // Lĩnh vực con được chọn thì chọn luôn lĩnh vực cha (lặp 2 lần cho đủ cấp)
  for (let i = 0; i < 2; i++) {
    areas.forEach(a => { if (hit.has(a.id) && a.parent_id) hit.add(a.parent_id) })
  }
  return [...hit]
}