import { titleCase } from './utils'

// Lấy DOI từ chuỗi bất kỳ: "10.1038/nature14539" hoặc "https://doi.org/10.1038/nature14539"
export function extractDoi(text) {
  const m = String(text || '').match(/10\.\d{4,9}\/[^\s"<>]+/i)
  return m ? m[0].replace(/[.,;)\]]+$/, '') : null
}

const plain = s => new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent.trim()

const first = v => (Array.isArray(v) ? v[0] : v)

const fixCase = s => (s === s.toUpperCase() || s === s.toLowerCase() ? titleCase(s) : s)

// ---------- Crossref ----------
const CROSSREF_TYPES = {
  'journal-article': 'JOURNAL',
  'proceedings-article': 'CONFERENCE',
  book: 'BOOK',
  monograph: 'BOOK',
  'edited-book': 'BOOK',
  'book-chapter': 'BOOK_CHAPTER',
  dissertation: 'THESIS',
}

// Trả về null nếu không tìm thấy (404), ném lỗi nếu mạng/máy chủ có vấn đề
async function fetchCrossref(doi) {
  const res = await fetch(`https://api.crossref.org/works/${encodeURI(doi)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('crossref-error')
  const m = (await res.json()).message

  const date = m.issued?.['date-parts']?.[0] || m.published?.['date-parts']?.[0] || []
  // Hệ thống dùng quy ước "Họ đứng trước", nên ghép họ + tên
  const authors = (m.author || [])
    .map(a => (a.family ? `${a.family} ${a.given || ''}` : a.name || '').trim())
    .filter(Boolean)
    .map(titleCase)

  return {
    title: plain(m.title?.[0]),
    abstract: plain(m.abstract),
    publication_type: CROSSREF_TYPES[m.type] || 'OTHER',
    publication_year: date[0] || '',
    journal: plain(m['container-title']?.[0] || m.publisher),
    volume: m.volume || '',
    issue: m.issue || '',
    pages: m.page || '',
    doi: m.DOI || doi,
    issn: m.ISSN?.[0] || '',
    isbn: m.ISBN?.[0] || '',
    keywords: (m.subject || []).join(', '),
    citation_count: m['is-referenced-by-count'] || 0,
    authors,
  }
}

// ---------- DataCite (Zenodo, Figshare, dataset...) ----------
const DATACITE_TYPES = {
  JournalArticle: 'JOURNAL',
  ConferencePaper: 'CONFERENCE',
  ConferenceProceeding: 'CONFERENCE',
  Book: 'BOOK',
  BookChapter: 'BOOK_CHAPTER',
  Dissertation: 'THESIS',
}

async function fetchDataCite(doi) {
  const res = await fetch(`https://api.datacite.org/dois/${encodeURI(doi)}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('datacite-error')
  const a = (await res.json()).data?.attributes || {}

  // Tên DataCite thường là "Họ, Tên" -> chuyển thành "Họ Tên"
  const authors = (a.creators || [])
    .map(c => {
      if (c.familyName) return `${c.familyName} ${c.givenName || ''}`
      return String(c.name || '').replace(/\s*,\s*/g, ' ')
    })
    .map(s => s.trim())
    .filter(Boolean)
    .map(titleCase)

  const descriptions = a.descriptions || []
  const abstractItem = descriptions.find(d => d.descriptionType === 'Abstract') || descriptions[0]

  const publisher = typeof a.publisher === 'object' ? a.publisher?.name : a.publisher
  const pageFrom = a.container?.firstPage || ''
  const pageTo = a.container?.lastPage || ''

  return {
    title: plain(a.titles?.[0]?.title),
    abstract: plain(abstractItem?.description),
    publication_type: DATACITE_TYPES[a.types?.resourceTypeGeneral] || 'OTHER',
    publication_year: a.publicationYear || '',
    journal: plain(a.container?.title || publisher),
    volume: a.container?.volume || '',
    issue: a.container?.issue || '',
    pages: pageFrom && pageTo ? `${pageFrom}-${pageTo}` : pageFrom,
    doi: a.doi || doi,
    issn: '',
    isbn: '',
    keywords: (a.subjects || []).map(s => s.subject).filter(Boolean).join(', '),
    citation_count: a.citationCount || 0,
    authors,
  }
}

// ---------- Hàm chính ----------
export async function fetchByDoi(doi) {
  let networkError = false

  for (const source of [fetchCrossref, fetchDataCite]) {
    try {
      const result = await source(doi)
      if (result) return result
    } catch {
      networkError = true
    }
  }

  if (networkError) {
    throw new Error('Không kết nối được máy chủ tra cứu DOI, thử lại sau ít phút.')
  }
  throw new Error('Không tìm thấy DOI này. Hãy kiểm tra lại.')
}