// Gợi ý lĩnh vực dựa trên tiêu đề, từ khóa và tóm tắt
const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

// Từ khóa nhận diện cho từng lĩnh vực (không dấu, tiếng Anh và tiếng Việt)
const RULES = {
      'mang may tinh': ['computer network', 'wireless network', 'sdn', 'mang may tinh', 'mang khong day'],
  'cong nghe phan mem': ['software engineering', 'software development', 'agile', 'devops', 'microservice', 'cong nghe phan mem', 'lap trinh'],
  'internet van vat': ['internet of things', 'iot', 'sensor network', 'smart home', 'van vat'],
  'dien toan dam may': ['cloud computing', 'cloud', 'serverless', 'kubernetes', 'dam may'],
  'co so du lieu': ['database', 'sql', 'nosql', 'data warehouse', 'co so du lieu'],
  'thiet ke do hoa va da phuong tien': ['graphic design', 'multimedia', 'animation', 'game design', 'augmented reality', 'virtual reality', 'do hoa', 'da phuong tien'],
  'xu ly ngon ngu tu nhien': ['natural language processing', 'nlp', 'text mining', 'sentiment', 'machine translation', 'xu ly ngon ngu', 'ngon ngu tu nhien'],

  'co khi': ['mechanical engineering', 'mechanical', 'machining', 'cnc', 'co khi', 'gia cong'],
  'che tao may': ['manufacturing', 'machine tool', 'casting', 'welding', 'cnc', 'che tao may'],
  'ky thuat o to': ['automotive', 'electric vehicle', 'vehicle', 'engine', 'internal combustion', 'o to', 'dong co'],
  'ky thuat dien va dien tu': ['electrical engineering', 'power system', 'power electronics', 'circuit', 'embedded', 'microcontroller', 'fpga', 'dien tu', 'he thong dien', 'vi dieu khien'],
  'tu dong hoa va dieu khien': ['automation', 'control system', 'pid', 'plc', 'scada', 'tu dong hoa', 'dieu khien'],
  'robot va co dien tu': ['robot', 'mechatronics', 'manipulator', 'drone', 'uav', 'co dien tu'],
  'xay dung': ['construction', 'civil engineering', 'concrete', 'structural', 'bridge', 'xay dung', 'ket cau', 'be tong'],
  'cong nghe vat lieu': ['material', 'nanomaterial', 'composite', 'polymer', 'alloy', 'vat lieu'],
  'cong nghe thuc pham': ['food', 'food technology', 'fermentation', 'thuc pham', 'che bien'],
  'cong nghe hoa hoc': ['chemical engineering', 'catalyst', 'chemical process', 'xuc tac', 'cong nghe hoa hoc'],
  'cong nghe may va thoi trang': ['garment', 'textile', 'apparel', 'fashion', 'may mac', 'det may', 'thoi trang'],
  'san xuat thong minh': ['smart manufacturing', 'industry 4.0', 'digital twin', 'lean manufacturing', 'cong nghiep 4.0', 'san xuat thong minh'],

  'quan tri kinh doanh': ['business management', 'management', 'strategy', 'leadership', 'human resource', 'quan tri', 'kinh doanh', 'nhan su'],
  'ke toan va tai chinh': ['accounting', 'finance', 'financial', 'audit', 'investment', 'banking', 'ke toan', 'tai chinh', 'kiem toan', 'ngan hang'],
  'marketing': ['marketing', 'brand', 'consumer behavior', 'advertising', 'thuong hieu', 'hanh vi nguoi tieu dung'],
  'thuong mai dien tu': ['e-commerce', 'ecommerce', 'online shopping', 'digital payment', 'thuong mai dien tu', 'mua sam truc tuyen'],
  'logistics va chuoi cung ung': ['logistics', 'supply chain', 'warehouse', 'transportation', 'chuoi cung ung', 'van tai', 'kho van'],
  'khoi nghiep va doi moi sang tao': ['startup', 'entrepreneur', 'innovation', 'khoi nghiep', 'doi moi sang tao'],

  'phuong phap giang day': ['teaching method', 'pedagogy', 'active learning', 'problem-based', 'blended learning', 'phuong phap giang day', 'day hoc'],
  'giao duc nghe nghiep': ['vocational', 'technical education', 'tvet', 'giao duc nghe nghiep', 'day nghe', 'ky nang nghe'],
  'giao duc stem': ['stem', 'steam', 'giao duc stem'],
  'cong nghe giao duc': ['edtech', 'educational technology', 'e-learning', 'online learning', 'lms', 'cong nghe giao duc', 'hoc truc tuyen'],
  'danh gia va kiem tra': ['assessment', 'examination', 'danh gia nang luc', 'kiem tra danh gia'],
  'giao duc dai hoc': ['higher education', 'university', 'undergraduate', 'dai hoc', 'giao duc dai hoc'],

  'toan hoc': ['mathematic', 'algebra', 'calculus', 'optimization', 'differential equation', 'toan hoc', 'dai so', 'giai tich'],
  'vat ly': ['physics', 'quantum', 'optics', 'laser', 'semiconductor', 'vat ly', 'quang hoc'],
  'hoa hoc': ['chemistry', 'chemical', 'molecule', 'spectroscopy', 'hoa hoc'],
  'sinh hoc': ['biology', 'biological', 'genetic', 'genome', 'protein', 'sinh hoc'],

  'ngon ngu va ngoai ngu': ['linguistics', 'language learning', 'english language', 'translation', 'ielts', 'ngon ngu hoc', 'ngoai ngu', 'tieng anh', 'dich thuat'],
  'tam ly hoc': ['psychology', 'mental health', 'cognitive', 'behavior', 'tam ly', 'suc khoe tinh than'],
  'du lich va dich vu': ['tourism', 'hospitality', 'hotel', 'travel', 'du lich', 'khach san'],
  'truyen thong': ['journalism', 'social media', 'media', 'communication', 'truyen thong', 'bao chi', 'mang xa hoi'],
  'xa hoi hoc': ['sociology', 'social change', 'social inequality', 'xa hoi hoc', 'bat binh dang'],

  'nang luong tai tao': ['renewable energy', 'solar', 'wind energy', 'photovoltaic', 'biomass', 'hydrogen', 'nang luong tai tao', 'nang luong mat troi', 'pin mat troi'],
  'bien doi khi hau': ['climate change', 'global warming', 'carbon', 'greenhouse', 'emission', 'bien doi khi hau', 'phat thai', 'nha kinh'],
  'quan ly moi truong': ['environmental', 'wastewater', 'pollution', 'recycling', 'sustainab', 'moi truong', 'xu ly nuoc thai', 'o nhiem', 'rac thai'],

  'y sinh va cong nghe sinh hoc': ['biomedical', 'biotechnology', 'medical', 'healthcare', 'clinical', 'y sinh', 'y te', 'cong nghe sinh hoc'],
  'dinh duong va suc khoe cong dong': ['nutrition', 'public health', 'diet', 'obesity', 'dinh duong', 'suc khoe cong dong'],
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