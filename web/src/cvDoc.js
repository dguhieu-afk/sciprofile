import { highestCompletedDegree, sortEducation, isAcademicRank, PROFESSIONAL_TITLES } from './academicLogic'
import {
  Document, Paragraph, TextRun, Table, TableRow, TableCell, AlignmentType,
  WidthType, BorderStyle, LevelFormat, Header, PageNumber,
} from 'docx'

const FONT = 'Times New Roman'
const W = 9298

const t = (text, o = {}) => new TextRun({ text: text == null ? '' : String(text), font: FONT, size: 24, ...o })
const para = (children, o = {}) =>
  new Paragraph({
    children: Array.isArray(children) ? children : [t(children)],
    spacing: { after: 60, line: 300 },
    ...o,
  })
const bold = text => para([t(text, { bold: true })])
const dash = text => new Paragraph({
  children: [t(text)], numbering: { reference: 'dash', level: 0 }, spacing: { after: 60, line: 300 },
})

const NONE = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' }
const LINE = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const noBorders = { top: NONE, bottom: NONE, left: NONE, right: NONE }
const allLine = { top: LINE, bottom: LINE, left: LINE, right: LINE }
const tableNone = { ...noBorders, insideHorizontal: NONE, insideVertical: NONE }
const tableLine = { ...allLine, insideHorizontal: LINE, insideVertical: LINE }
const margins = { top: 50, bottom: 50, left: 90, right: 90 }

const cell = (children, w, o = {}) =>
  new TableCell({
    width: { size: w, type: WidthType.DXA },
    margins,
    children: Array.isArray(children) ? children : [children],
    ...o,
  })

const mkTable = (widths, rows, bordered) =>
  new Table({
    width: { size: widths.reduce((a, b) => a + b, 0), type: WidthType.DXA },
    columnWidths: widths,
    borders: bordered ? tableLine : tableNone,
    rows,
  })

function kv(rows) {
  const [a, b] = [4800, 4498]
  const label = (l, v) => para([t(`${l}: `), t(v || '')], { spacing: { after: 0, line: 300 } })
  const visible = rows.map(r => r.filter(([_, v]) => v !== '' && v !== null && v !== undefined && String(v).trim() !== '')).filter(r => r.length)
  return mkTable([a, b], visible.map(r =>
    r.length === 1
      ? new TableRow({ children: [cell(label(...r[0]), W, { columnSpan: 2, borders: noBorders })] })
      : new TableRow({ children: [
          cell(label(...r[0]), a, { borders: noBorders }),
          cell(label(...r[1]), b, { borders: noBorders }),
        ] })
  ), false)
}

function grid(widths, head, rows, emptyCols) {
  const hrow = new TableRow({
    tableHeader: true,
    children: head.map((h, i) => cell(
      para([t(h, { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }), widths[i], { borders: allLine }
    )),
  })
  const body = (rows.length ? rows : [Array(emptyCols).fill('')]).map(r =>
    new TableRow({
      cantSplit: true,
      children: r.map((v, i) => cell(
        para([t(v)], { spacing: { after: 0, line: 280 }, alignment: i === 0 ? AlignmentType.CENTER : AlignmentType.LEFT }),
        widths[i], { borders: allLine }
      )),
    })
  )
  return mkTable(widths, [hrow, ...body], true)
}

const fmtDate = s => {
  if (!s) return ''
  const [y, m, d] = String(s).split('-')
  return y && m && d ? `${d}/${m}/${y}` : String(s)
}
const yrs = (a, b) => (a ? `${a} – ${b || 'nay'}` : '')

export function buildCvDoc(d) {
  const { r, p = {}, orgChain = '', rootOrg = '', edu = [], exp = [], langs = [], projects = [], pubs = [] } = d
  const now = new Date()
  const dateLine = `.........., ngày ${String(now.getDate()).padStart(2, '0')} tháng ${String(now.getMonth() + 1).padStart(2, '0')} năm ${now.getFullYear()}`

  const orderedEducation = sortEducation(edu)
  const highest = highestCompletedDegree(orderedEducation)
  const byEnd = (a, b) => (a.end_year || 9999) - (b.end_year || 9999)
  const uni = edu.filter(e => ['Cử nhân', 'Kỹ sư'].includes(e.degree)).sort(byEnd)
  const u1 = uni[0] || {}
  const u2 = uni[1]
  const ths = orderedEducation.filter(e => e.degree === 'Thạc sĩ').sort(byEnd).at(-1) || {}
  const ts = orderedEducation.filter(e => e.degree === 'Tiến sĩ').sort(byEnd).at(-1) || {}

  const phones = [['CQ',p.phone_office], ['NR',p.phone_home], ['DĐ',p.phone]].filter(([,v]) => v).map(([l,v]) => `${l}: ${v}`).join('     ')
  const reportedHighest = edu.length === 0 ? r.academic_degree : null
  const degreeYear = [highest?.end_year || (edu.length === 0 ? r.degree_year : null), highest?.country || (edu.length === 0 ? r.degree_country : null)].filter(Boolean).join(', ')
  const academicRank = isAcademicRank(r.academic_title) ? r.academic_title : ''
  const professional = r.professional_title || (PROFESSIONAL_TITLES.includes(r.academic_title) ? r.academic_title : '')

  const children = [
    para([t('BỘ GIÁO DỤC VÀ ĐÀO TẠO', { bold: true })]),
    para([t('Phụ lục III', { bold: true })], { alignment: AlignmentType.CENTER }),
    para([t('LÝ LỊCH KHOA HỌC', { bold: true })], { alignment: AlignmentType.CENTER }),
    para([t('(Kèm theo Thông tư số: 09/2017/TT-BGDĐT ngày 04 tháng 4 năm 2017 của', { italics: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
    para([t('Bộ trưởng Bộ Giáo dục và Đào tạo)', { italics: true })], { alignment: AlignmentType.CENTER, spacing: { after: 200 } }),

    mkTable([4400, 4898], [new TableRow({ children: [
      cell([
        para('BỘ, NGÀNH (Cơ quan chủ quản nếu có)', { spacing: { after: 60 } }),
        para([t((rootOrg || 'TÊN CƠ SỞ ĐÀO TẠO').toUpperCase(), { bold: true })]),
      ], 4400, { borders: noBorders }),
      cell([
        para([t('CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
        para([t('Độc lập - Tự do - Hạnh phúc', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 60 } }),
        para([t('')], { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, indent: { left: 1200, right: 1200 }, spacing: { after: 60 } }),
        para([t(dateLine, { italics: true })], { alignment: AlignmentType.CENTER }),
      ], 4898, { borders: noBorders }),
    ] })], false),

    para([t('')], { border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '000000', space: 1 } }, spacing: { after: 200 } }),
    para([t('LÝ LỊCH KHOA HỌC', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 240 } }),

    bold('I. LÝ LỊCH SƠ LƯỢC'),
    kv([
      [['Họ và tên', r.full_name], ['Giới tính', r.gender]],
      [['Ngày, tháng, năm sinh', fmtDate(p.birth_date)], ['Nơi sinh', p.birth_place]],
      [['Số căn cước công dân', p.citizen_id], ['Ngày cấp CCCD', fmtDate(p.citizen_id_issue_date)]],
      [['Cơ quan cấp CCCD', p.citizen_id_issued_by]],
      [['Quê quán', p.hometown], ['Dân tộc', p.ethnicity]],
      [['Học vị cao nhất', highest?.degree || reportedHighest || 'Chưa có dữ liệu đào tạo xác minh'], ['Năm, nước nhận học vị', degreeYear]],
      [['Học hàm cao nhất', academicRank], ['Năm công nhận học hàm cao nhất', academicRank && r.title_year]],
      [['Phó giáo sư – năm công nhận', p.associate_professor_year], ['Giáo sư – năm công nhận', p.professor_year]],
      [['Chức danh nghề nghiệp', professional], ['Năm bổ nhiệm chức danh nghề nghiệp', professional && r.professional_title_year]],
      [['Chức vụ (hiện tại hoặc trước khi nghỉ hưu)', r.position]],
      [['Đơn vị công tác (hiện tại hoặc trước khi nghỉ hưu)', orgChain]],
      [['Chỗ ở riêng hoặc địa chỉ liên lạc', p.address]],
      [['Điện thoại liên hệ', phones]],
      [['Fax', p.fax], ['Email', r.contact_email]],
    ]),

    para([t('')], { spacing: { after: 60 } }),
    bold('II. QUÁ TRÌNH ĐÀO TẠO'),
    para('Toàn bộ văn bằng và giai đoạn đào tạo (sắp xếp theo thời gian cấp bằng/kết thúc từ cũ đến mới):'),
    grid([650, 1800, 1450, 1548, 2350, 1500],
      ['TT', 'Bậc đào tạo', 'Thời gian', 'Ngành/chuyên ngành', 'Cơ sở đào tạo', 'Quốc gia'],
      orderedEducation.map((e, i) => [String(i + 1), e.degree || '', yrs(e.start_year, e.end_year), e.major || '', e.institution || '', e.country || '']), 6),
    ...orderedEducation.filter(e => e.thesis_title).map(e => dash(`${e.degree} (${e.end_year || ''}) – Luận văn/luận án: ${e.thesis_title}`)),

    ...(uni.length ? [bold('1. Đại học:')] : []),
    ...(uni.length ? [kv([
      [['Hệ đào tạo', u1.training_system]],
      [['Nơi đào tạo', u1.institution]],
      [['Ngành học', u1.major]],
      [['Nước đào tạo', u1.country], ['Năm tốt nghiệp', u1.end_year]],
      [['Bằng đại học 2', u2 ? [u2.major, u2.institution].filter(Boolean).join(' – ') : ''], ['Năm tốt nghiệp', u2?.end_year]],
    ])] : []),
    ...((ths.degree || ts.degree) ? [bold('2. Sau đại học')] : []),
    ...(ths.degree ? [dash(`Thạc sĩ ngành/chuyên ngành: ${ths.major || 'Chưa khai báo'}`), kv([[['Năm cấp bằng', ths.end_year], ['Nơi đào tạo', ths.institution]]])] : []),
    ...(ths.thesis_title ? [dash(`Tên luận văn: ${ths.thesis_title}`)] : []),
    ...(ts.degree ? [dash(`Tiến sĩ chuyên ngành: ${ts.major || 'Chưa khai báo'}`), kv([[['Năm cấp bằng', ts.end_year], ['Nơi đào tạo', ts.institution]]])] : []),
    ...(ts.thesis_title ? [dash(`Tên luận án: ${ts.thesis_title}`)] : []),

    para([t('')], { spacing: { after: 0 } }),
    ...(langs.length ? [mkTable([2500, 3250, 3548],
      langs.map((l, i) => new TableRow({ children: [
        cell(para([t(i === 0 ? '3. Ngoại ngữ:' : '', { bold: true })], { spacing: { after: 0 } }), 2500, { borders: noBorders }),
        cell(para(`${i + 1}. ${l.language || ''}`, { spacing: { after: 0 } }), 3250, { borders: noBorders }),
        cell(para(`Mức độ sử dụng: ${l.level || ''}`, { spacing: { after: 0 } }), 3548, { borders: noBorders }),
      ] })), false)] : []),

    para([t('')], { spacing: { after: 60 } }),
    bold('III. QUÁ TRÌNH CÔNG TÁC CHUYÊN MÔN'),
    grid([1900, 3100, 4298],
      ['Thời gian', 'Đơn vị công tác', 'Công việc đảm nhiệm'],
      exp.map(e => [yrs(e.start_year, e.end_year), e.organization || '',
        [e.position, e.description].filter(Boolean).join(' – ')]), 3),

    para([t('')], { spacing: { after: 60 } }),
    bold('IV. QUÁ TRÌNH NGHIÊN CỨU KHOA HỌC'),
    para('1. Các đề tài nghiên cứu khoa học đã và đang tham gia (thuộc danh mục Hội đồng Chức danh giáo sư nhà nước quy định):'),
    grid([650, 2950, 1550, 1980, 2168],
      ['TT', 'Tên đề tài nghiên cứu', 'Năm bắt đầu/Năm hoàn thành', 'Đề tài cấp (NN, Bộ, ngành, trường)', 'Trách nhiệm tham gia trong đề tài'],
      projects.map((x, i) => [String(i + 1), x.title, `${x.start_year || ''}/${x.end_year || ''}`, x.level || '', x.role || '']), 5),

    para([t('')], { spacing: { after: 60 } }),
    para('2. Danh mục công trình từ hồ sơ UTEProfile (phân biệt công khai và chờ kiểm duyệt).'),
    grid([650, 3450, 1200, 2598, 1400],
      ['TT', 'Tên công trình', 'Năm', 'Tạp chí / nơi công bố', 'Trạng thái'],
      pubs.map((x, i) => [String(i + 1), x.title || '', String(x.publication_year || ''), x.journal || '',
        x.status === 'APPROVED' ? 'Đã công khai' : x.status === 'PENDING' ? 'Chờ duyệt' : x.status === 'REJECTED' ? 'Bị từ chối' : (x.status || 'Bản nháp')]), 5),

    para([t('')], { spacing: { after: 200 } }),
    mkTable([3600, 5698], [new TableRow({ cantSplit: true, children: [
      cell([para([t('Xác nhận của cơ quan', { bold: true })])], 3600, { borders: noBorders }),
      cell([
        para([t(dateLine, { italics: true })], { alignment: AlignmentType.CENTER }),
        para([t('Người khai kí tên', { bold: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
        para([t('(Ghi rõ chức danh, học vị)', { italics: true })], { alignment: AlignmentType.CENTER, spacing: { after: 900 } }),
        para([t([academicRank, highest?.degree || reportedHighest].filter(Boolean).join(', '), { italics: true })], { alignment: AlignmentType.CENTER, spacing: { after: 0 } }),
        para([t(r.full_name, { bold: true })], { alignment: AlignmentType.CENTER }),
      ], 5698, { borders: noBorders }),
    ] })], false),
  ]

  return new Document({
    creator: 'UTEProfile',
    title: `Lý lịch khoa học - ${r.full_name}`,
    styles: { default: { document: { run: { font: FONT, size: 24 } } } },
    numbering: { config: [{ reference: 'dash', levels: [{
      level: 0, format: LevelFormat.BULLET, text: '-', alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720, hanging: 360 } } },
    }] }] },
    sections: [{
      properties: { page: { size: { width: 11907, height: 16840 }, margin: { top: 1134, right: 1021, bottom: 1000, left: 1588 } } },
      headers: { default: new Header({ children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 24 })] })] }) },
      children,
    }],
  })
}