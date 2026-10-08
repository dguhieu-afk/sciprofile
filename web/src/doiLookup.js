import { titleCase } from './utils'

// Lấy DOI từ chuỗi bất kỳ: "10.1038/nature14539" hoặc "https://doi.org/10.1038/nature14539"
export function extractDoi(text) {
  const m = String(text || '').match(/10\.\d{4,9}\/[^\s"<>]+/i)
  return m ? m[0].replace(/[.,;)\]]+$/, '') : null
}

const plain = s => new DOMParser().parseFromString(String(s || ''), 'text/html').body.textContent.trim()

const TYPES = {
  'journal-article': 'JOURNAL',
  'proceedings-article': 'CONFERENCE',
  book: 'BOOK',
  monograph: 'BOOK',
  'edited-book': 'BOOK',
  'book-chapter': 'BOOK_CHAPTER',
  dissertation: 'THESIS',
}

export async function fetchByDoi(doi) {
  const res = await fetch(`https://api.crossref.org/works/${encodeURI(doi)}`)
  if (res.status === 404) throw new Error('Không tìm thấy DOI này trên Crossref. Hãy kiểm tra lại.')
  if (!res.ok) throw new Error('Không kết nối được Crossref, thử lại sau ít phút.')
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
    publication_type: TYPES[m.type] || 'OTHER',
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