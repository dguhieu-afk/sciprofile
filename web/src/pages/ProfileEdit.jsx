import { useUI } from '../ui'
import AvatarUpload from '../components/AvatarUpload'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, Lock, ChevronDown, Save } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { liveCap, titleCase, capFirst } from '../utils'
import ExportCvButton from '../components/ExportCvButton'
import CvAttachmentUpload from "../CvAttachmentUpload";
import { highestCompletedDegree, sortEducation, validateEducation, academicWarnings, ACADEMIC_RANKS, PROFESSIONAL_TITLES, isAcademicRank } from '../academicLogic'
import './ProfileEditProfessional.css'
import './GuestLecturingEligibility.css'

const yearRange = (a, b) => (a ? `${a} – ${b || 'nay'}` : '')
const num = v => (v === '' || v == null ? null : parseInt(v, 10))
const cleanPhone = s => String(s || '').replace(/[\s.\-]/g, '')
const mobilePhoneOk = s => !s || /^0\d{9}$/.test(s)
const phoneOk = s => !s || /^(0|\+84)\d{9,10}$/.test(s)

// Danh sách 34 tỉnh/thành hiện hành để chọn chính xác; không cho lưu chữ nhập dở.
const vietnamProvinces = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Điện Biên',
  'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Nội', 'Hà Tĩnh', 'Hải Phòng',
  'Hưng Yên', 'Khánh Hòa', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
  'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sơn La', 'Tây Ninh', 'Thái Nguyên', 'Thanh Hóa', 'Thành phố Đà Nẵng',
  'Thành phố Hồ Chí Minh', 'Thành phố Huế', 'Tuyên Quang', 'Vĩnh Long',
  'Thành phố Cần Thơ',
]

// Gợi ý khi gõ nhưng chỉ chấp nhận địa danh đã chọn chính xác.
const normalizeLocation = value => String(value || '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D')
  .toLocaleLowerCase('vi').trim()

function ProvinceAutocomplete({ label, value, onChange, items = vietnamProvinces }) {
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const search = normalizeLocation(value)
  const results = !search ? items : items
    .filter(name => normalizeLocation(name).includes(search))
    .sort((a, b) => {
      const ap = normalizeLocation(a).startsWith(search) ? 0 : 1
      const bp = normalizeLocation(b).startsWith(search) ? 0 : 1
      return ap - bp || a.localeCompare(b, 'vi')
    })
  const choices = results.slice(0, 8)
  const valid = items.includes(String(value || '').trim())
  const inputId = useRef(`province-${Math.random().toString(36).slice(2)}`).current
  const pick = (name) => { onChange(name); setOpen(false); setActive(0) }

  return (
    <div className="province-autocomplete" style={{ position: 'relative', minWidth: 0 }}>
      <label htmlFor={inputId} className="lock" style={{ display: 'block', marginBottom: 8 }}>
        <Lock size={12} /> {label} *
      </label>
      <input
        id={inputId}
        type="text"
        value={value || ''}
        onChange={e => { onChange(e.target.value); setActive(0); setOpen(true) }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        autoComplete="off"
        placeholder="Gõ tên tỉnh/thành, ví dụ: Lâm..."
        role="combobox"
        aria-expanded={open && choices.length > 0}
        aria-controls={`${inputId}-list`}
        aria-autocomplete="list"
        onKeyDown={e => {
          if (e.key === 'Escape') setOpen(false)
          if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(i => Math.min(i + 1, choices.length - 1)) }
          if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(0, i - 1)) }
          if (e.key === 'Enter' && open && choices.length) { e.preventDefault(); pick(choices[active] || choices[0]) }
        }}
        style={{ width: '100%' }}
      />
      {open && choices.length > 0 && (
        <div id={`${inputId}-list`} role="listbox"
          style={{ position: 'absolute', zIndex: 80, top: '100%', left: 0, right: 0, background: '#fff', border: '1px solid #d4deea', borderRadius: 12, boxShadow: '0 12px 28px rgba(10,30,60,.13)', maxHeight: 260, overflowY: 'auto', marginTop: 4 }}>
          {choices.map((name, i) => (
            <button type="button" key={name} role="option" aria-selected={active === i}
              onMouseDown={e => e.preventDefault()} onClick={() => pick(name)}
              style={{ display: 'block', width: '100%', textAlign: 'left', border: 0, background: active === i ? '#eef4ff' : '#fff', padding: '11px 14px', cursor: 'pointer', color: '#1e3152' }}>
              {name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// Đối chiếu địa danh trước khi ghi vào CSDL. Không dựa vào riêng HTML validation.
const validProvince = value => vietnamProvinces.includes(String(value || '').trim())
// Kiểm tra ngày theo lịch, không chuyển múi giờ để tránh lệch một ngày ở Việt Nam.
const validCivilDate = value => {
  const text = String(value || '')
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text)
  if (!match) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(0)
  date.setUTCFullYear(year, month - 1, day)
  date.setUTCHours(0, 0, 0, 0)
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

// Danh mục gợi ý phổ biến, không phải danh sách chứng chỉ toàn cầu đầy đủ.
// Người dùng luôn có thể nhập tên ngôn ngữ/chứng chỉ khác.
const LANGUAGE_CERTIFICATES = {
  'Tiếng Anh': ['IELTS Academic', 'IELTS General Training', 'TOEFL iBT', 'TOEIC Listening & Reading', 'TOEIC Speaking & Writing', 'Cambridge B2 First (FCE)', 'Cambridge C1 Advanced (CAE)', 'Cambridge C2 Proficiency (CPE)', 'PTE Academic', 'Duolingo English Test', 'Aptis ESOL', 'Linguaskill', 'OET', 'CELPIP', 'Trình độ CEFR A1', 'Trình độ CEFR A2', 'Trình độ CEFR B1', 'Trình độ CEFR B2', 'Trình độ CEFR C1', 'Trình độ CEFR C2'],
  'Tiếng Trung': ['HSK 1', 'HSK 2', 'HSK 3', 'HSK 4', 'HSK 5', 'HSK 6', 'HSKK sơ cấp', 'HSKK trung cấp', 'HSKK cao cấp', 'TOCFL A1', 'TOCFL A2', 'TOCFL B1', 'TOCFL B2', 'TOCFL C1', 'TOCFL C2', 'BCT'],
  'Tiếng Nhật': ['JLPT N5', 'JLPT N4', 'JLPT N3', 'JLPT N2', 'JLPT N1', 'J.TEST', 'NAT-TEST', 'BJT Business Japanese'],
  'Tiếng Hàn': ['TOPIK I - cấp 1', 'TOPIK I - cấp 2', 'TOPIK II - cấp 3', 'TOPIK II - cấp 4', 'TOPIK II - cấp 5', 'TOPIK II - cấp 6', 'EPS-TOPIK', 'KLAT'],
  'Tiếng Pháp': ['DELF A1', 'DELF A2', 'DELF B1', 'DELF B2', 'DALF C1', 'DALF C2', 'TCF', 'TEF', 'TEF Canada'],
  'Tiếng Đức': ['Goethe-Zertifikat A1', 'Goethe-Zertifikat A2', 'Goethe-Zertifikat B1', 'Goethe-Zertifikat B2', 'Goethe-Zertifikat C1', 'Goethe-Zertifikat C2', 'TestDaF', 'DSH', 'telc Deutsch B1', 'telc Deutsch B2', 'ÖSD'],
  'Tiếng Tây Ban Nha': ['DELE A1', 'DELE A2', 'DELE B1', 'DELE B2', 'DELE C1', 'DELE C2', 'SIELE'],
  'Tiếng Ý': ['CILS A1', 'CILS A2', 'CILS B1', 'CILS B2', 'CILS C1', 'CILS C2', 'CELI', 'PLIDA'],
  'Tiếng Bồ Đào Nha': ['CAPLE CIPLE (A2)', 'CAPLE DEPLE (B1)', 'CAPLE DIPLE (B2)', 'CAPLE DAPLE (C1)', 'CAPLE DUPLE (C2)', 'Celpe-Bras'],
  'Tiếng Nga': ['TORFL / TRKI A1', 'TORFL / TRKI A2', 'TORFL / TRKI B1', 'TORFL / TRKI B2', 'TORFL / TRKI C1', 'TORFL / TRKI C2'],
  'Tiếng Ả Rập': ['ALPT', 'CIMA', 'Trình độ CEFR A1', 'Trình độ CEFR B1', 'Trình độ CEFR B2'],
  'Tiếng Hà Lan': ['CNaVT', 'Staatsexamen NT2 Programma I', 'Staatsexamen NT2 Programma II'],
  'Tiếng Thổ Nhĩ Kỳ': ['TYS (Türkçe Yeterlik Sınavı)', 'TÖMER'],
  'Tiếng Thái': ['CU-TFL'],
  'Tiếng Indonesia': ['UKBI'],
  'Tiếng Việt': ['VSTEP B1', 'VSTEP B2', 'VSTEP C1', 'Chứng chỉ tiếng Việt cho người nước ngoài'],
}
const LANGUAGE_OPTIONS = [
  ...Object.keys(LANGUAGE_CERTIFICATES),
  'Tiếng Hindi', 'Tiếng Bengali', 'Tiếng Urdu', 'Tiếng Ba Tư', 'Tiếng Do Thái',
  'Tiếng Ba Lan', 'Tiếng Séc', 'Tiếng Hungary', 'Tiếng Romania', 'Tiếng Hy Lạp',
  'Tiếng Thụy Điển', 'Tiếng Na Uy', 'Tiếng Đan Mạch', 'Tiếng Phần Lan',
  'Tiếng Ukraina', 'Tiếng Malaysia', 'Tiếng Tagalog', 'Tiếng Khmer', 'Tiếng Lào',
  'Tiếng Myanmar', 'Tiếng Swahili', 'Tiếng Tamil', 'Tiếng Nepal', 'Tiếng Latin',
].sort((a, b) => a.localeCompare(b, 'vi'))
const certificatesForLanguage = (language) => {
  const key = Object.keys(LANGUAGE_CERTIFICATES).find(
    name => name.toLocaleLowerCase('vi') === String(language || '').trim().toLocaleLowerCase('vi')
  )
  return key ? LANGUAGE_CERTIFICATES[key] : [
    'Trình độ CEFR A1', 'Trình độ CEFR A2', 'Trình độ CEFR B1',
    'Trình độ CEFR B2', 'Trình độ CEFR C1', 'Trình độ CEFR C2',
  ]
}

// Các mục hồ sơ chia thành tab ngang. Không unmount form để tránh mất dữ liệu đang nhập.
const ProfileTabContext = createContext(null)

const PROFILE_TABS = [
  { id: 'personal', label: 'Lý lịch sơ lược', number: '01' },
  { id: 'workplace', label: 'Đơn vị & học hàm', number: '02' },
  { id: 'identity', label: 'Định danh khoa học', number: '03' },
  { id: 'education', label: 'Quá trình đào tạo', number: '04' },
  { id: 'experience', label: 'Quá trình công tác', number: '05' },
  { id: 'projects', label: 'Đề tài nghiên cứu', number: '06' },
  { id: 'awards', label: 'Khen thưởng', number: '07' },
  { id: 'languages', label: 'Ngoại ngữ', number: '08' },
  { id: 'extras', label: 'Hoạt động bổ sung', number: '09' },
]

function Collapse({ id, title, count, defaultOpen = false, ctl, children }) {
  const activeTab = useContext(ProfileTabContext)
  const tabbed = activeTab !== null
  const [localOpen, setLocalOpen] = useState(defaultOpen)
  useEffect(() => { if (!tabbed && ctl && ctl.n > 0) setLocalOpen(ctl.open) }, [ctl, tabbed])
  const open = tabbed ? activeTab === id : localOpen
  return (
    <section
      id={id ? `profile-panel-${id}` : undefined}
      role={tabbed ? 'tabpanel' : undefined}
      aria-labelledby={tabbed && id ? `profile-tab-${id}` : undefined}
      className={`form-card acc profile-section ${open ? 'open' : ''} ${tabbed ? 'profile-tab-panel' : ''}`}
      hidden={!open}
    >
      {tabbed ? (
        <div className="profile-panel-title">
          <h2>{title}</h2>
          {count != null && <span className="profile-panel-count">{count} mục đã lưu</span>}
        </div>
      ) : (
        <button type="button" className="acc-head" onClick={() => setLocalOpen(!localOpen)} aria-expanded={localOpen}>
          <span className="acc-title">{title}</span>
          {count != null && <em className="acc-count">{count}</em>}
          <ChevronDown size={20} className="acc-chev" />
        </button>
      )}
      <div className="acc-body" hidden={!open}>{children}</div>
    </section>
  )
}

function ItemSection({ id, title, hint, table, rid, fields, orderBy, asc, render, ctl, onItemsChanged, validateCandidate, sortItems }) {
  const blank = Object.fromEntries(fields.map(f => [f.key, '']))
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(blank)
  const [err, setErr] = useState('')
  const { confirm } = useUI()

  async function load() {
    const { data, error } = await supabase.from(table).select('*')
      .eq('researcher_id', rid).order(orderBy, { ascending: !!asc })
    if (error) { setErr(error.message); return }
    setItems(sortItems ? sortItems(data || []) : (data || []))
    if (onItemsChanged) onItemsChanged(data || [])
  }
  useEffect(() => { load() }, [rid]) // eslint-disable-line

  async function add(e) {
    e.preventDefault()
    const first = fields[0]
    if (!String(draft[first.key]).trim()) { setErr(`Vui lòng nhập "${first.label.replace(' *', '')}".`); return }
    const row = { researcher_id: rid }
    fields.forEach(f => {
      const v = draft[f.key]
      row[f.key] = f.type === 'number' ? num(v) : (String(v).trim() || null)
    })
    if (validateCandidate) {
      const validation = validateCandidate([...items, row])
      if (validation) { setErr(validation); return }
    }
    const { error } = await supabase.from(table).insert(row)
    if (error) { setErr(error.message); return }
    setErr(''); setDraft(blank); load()
  }

  async function remove(id) {
           if (!(await confirm({ title: 'Xóa mục này?', message: 'Thao tác này không thể hoàn tác.', confirmText: 'Xóa', danger: true }))) return
    const { error } = await supabase.from(table).delete().eq('id', id)
    if (error) { setErr(error.message); return }
    load()
  }

  return (
    <Collapse id={id} title={title} count={items.length} ctl={ctl}>
      {hint && <p className="hint">{hint}</p>}
      <div className="item-list">
        {items.length === 0 && <div className="item-empty">Chưa có mục nào.</div>}
        {items.map(i => {
          const r = render(i)
          return (
            <div className="item" key={i.id}>
              <div>
                <b>{r.main}</b>
                {r.sub && <div className="item-sub">{r.sub}</div>}
                {r.desc && <div className="item-desc">{r.desc}</div>}
              </div>
              <button type="button" className="icon-btn" onClick={() => remove(i.id)} title="Xóa"><Trash2 size={16} /></button>
            </div>
          )
        })}
      </div>

      <form className="add-form" onSubmit={add}>
        <div className="form-grid">
          {fields.map(f => (
            <label key={f.key} className={f.wide ? 'wide' : ''}>{f.label}
              {f.type === 'select' ? (
                <select value={draft[f.key]} onChange={e => setDraft({ ...draft, [f.key]: e.target.value })}>
                  <option value="">-- Chọn --</option>
                  {f.options.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : f.type === 'textarea' ? (
                <textarea rows={2} value={draft[f.key]} placeholder={f.placeholder}
                  onChange={e => setDraft({ ...draft, [f.key]: capFirst(e.target.value) })} />
              ) : (
                <>
                  <input
                    type={f.type || 'text'}
                    list={f.suggestions ? `profile-suggestions-${id}-${f.key}` : undefined}
                    value={draft[f.key]}
                    placeholder={f.placeholder}
                    autoComplete={f.suggestions ? 'off' : undefined}
                    onChange={e => setDraft(prev => ({
                      ...prev,
                      [f.key]: f.preserveCase || f.type === 'number' ? e.target.value : liveCap(e.target.value),
                    }))}
                  />
                  {f.suggestions && (
                    <datalist id={`profile-suggestions-${id}-${f.key}`}>
                      {(typeof f.suggestions === 'function' ? f.suggestions(draft) : f.suggestions)
                        .map(option => <option key={option} value={option} />)}
                    </datalist>
                  )}
                </>
              )}
            </label>
          ))}
        </div>
        {err && <div className="auth-error">{err}</div>}
        <button className="btn btn-ghost" type="submit"><Plus size={16} /> Thêm mục</button>
      </form>
    </Collapse>
  )
}

export default function ProfileEdit() {
  const { user, researcher, ready, reload } = useAuth()
  const navigate = useNavigate()
  const [f, setF] = useState(null)
  const [orgs, setOrgs] = useState([])
  const [degreeFromEducation, setDegreeFromEducation] = useState(null)
  const [educationRows, setEducationRows] = useState([])
  const [educationNotice, setEducationNotice] = useState([])
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [showGuestEligibility, setShowGuestEligibility] = useState(false)
  const [guestSubjectDraft, setGuestSubjectDraft] = useState('')
  const [ctl, setCtl] = useState({ open: false, n: 0 })
  const [activeTab, setActiveTab] = useState('personal')
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState('')
  const [addressFocused, setAddressFocused] = useState(false)
  const [selectedPosition, setSelectedPosition] = useState(null)
  const skipAddressSearchRef = useRef(false)
  const addressInputRef = useRef(null)
  const geoapifyKey = import.meta.env.VITE_GEOAPIFY_API_KEY?.trim() || ''

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  // Geoapify Address Autocomplete: chỉ gọi khi người dùng đang nhập.
  // Chờ 500ms và hủy yêu cầu trước để giảm lượt gọi API miễn phí.
  useEffect(() => {
    if (skipAddressSearchRef.current) {
      skipAddressSearchRef.current = false
      return
    }
    const query = String(f?.address || '').trim()
    if (!addressFocused || !geoapifyKey || query.length < 3) {
      setAddressSuggestions([])
      setAddressLoading(false)
      setAddressError('')
      return
    }

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      setAddressLoading(true)
      setAddressError('')
      try {
        const params = new URLSearchParams({
          text: query,
          format: 'json',
          filter: 'countrycode:vn',
          lang: 'vi',
          limit: '6',
          apiKey: geoapifyKey,
        })
        const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params}`, { signal: controller.signal })
        if (!response.ok) throw new Error(response.status === 403 ? 'API key không hợp lệ hoặc bị chặn theo tên miền.' : 'Không thể lấy gợi ý địa chỉ lúc này.')
        const payload = await response.json()
        const rows = Array.isArray(payload?.results) ? payload.results : []
        const seen = new Set()
        const suggestions = rows.filter(item => {
          const label = item.formatted || item.address_line1 || ''
          if (!label || seen.has(label)) return false
          seen.add(label)
          return true
        })
        setAddressSuggestions(suggestions)
      } catch (error) {
        if (error.name !== 'AbortError') {
          setAddressSuggestions([])
          setAddressError(error.message || 'Không thể tìm địa chỉ.')
        }
      } finally {
        if (!controller.signal.aborted) setAddressLoading(false)
      }
    }, 500)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [f?.address, addressFocused, geoapifyKey])

  useEffect(() => {
    if (!researcher) return
    supabase.from('researcher_private').select('*').eq('researcher_id', researcher.id).maybeSingle()
      .then(({ data: pr }) => setF({
        full_name: researcher.full_name || '',
        gender: researcher.gender || '',
        birth_date: pr?.birth_date || '',
        citizen_id: pr?.citizen_id || '',
        citizen_id_issue_date: pr?.citizen_id_issue_date || '',
        citizen_id_issued_by: pr?.citizen_id_issued_by || 'Cục Cảnh sát quản lý hành chính về trật tự xã hội.',
        birth_place: pr?.birth_place || '',
        hometown: pr?.hometown || '',
        ethnicity: pr?.ethnicity || '',
        nationality: researcher.nationality || '',
        address: pr?.address || '',
        phone: pr?.phone || '',
        phone_office: pr?.phone_office || '',
        phone_home: pr?.phone_home || '',
        fax: pr?.fax || '',
        contact_email: user?.email || '',
        position: researcher.position || '',
        academic_title: isAcademicRank(researcher.academic_title) ? researcher.academic_title : '',
        title_year: isAcademicRank(researcher.academic_title) ? (researcher.title_year || '') : '',
        professional_title: researcher.professional_title || (PROFESSIONAL_TITLES.includes(researcher.academic_title) ? researcher.academic_title : ''),
        professional_title_year: researcher.professional_title_year || (PROFESSIONAL_TITLES.includes(researcher.academic_title) ? (researcher.title_year || '') : ''),
        academic_degree: researcher.academic_degree || '',
        degree_year: researcher.degree_year || '',
        degree_country: researcher.degree_country || '',
        organization_id: researcher.organization_id || '',
        orcid: researcher.orcid || '',
        google_scholar_url: researcher.google_scholar_url || '',
        website: researcher.website || '',
        research_interests: researcher.research_interests || '',
        bio: researcher.bio || '',
        available_guest_lecturing: pr?.available_guest_lecturing ?? false,
        guest_lecturing_subjects: Array.isArray(pr?.guest_lecturing_subjects) ? pr.guest_lecturing_subjects : [],
        available_business_consulting: pr?.available_business_consulting ?? false,
        wants_research_collaboration: pr?.wants_research_collaboration ?? false,
        available_committee_service: pr?.available_committee_service ?? false,
        available_supervision: pr?.available_supervision ?? false,
        associate_professor_year: pr?.associate_professor_year || (researcher.academic_title === 'Phó giáo sư' ? researcher.title_year : '') || '',
        professor_year: pr?.professor_year || (researcher.academic_title === 'Giáo sư' ? researcher.title_year : '') || '',
      }))
  }, [researcher, user?.email])

  useEffect(() => {
    supabase.from('organizations').select('id,name').order('id').then(({ data }) => setOrgs(data || []))
  }, [])

  // Đồng bộ học vị từ những dòng đào tạo có năm cấp bằng hợp lệ.
  // Không xóa học vị cũ nếu người dùng chưa khai báo quá trình đào tạo.
  async function syncEducationDegree(items) {
    const best = highestCompletedDegree(items)
    setEducationRows(items)
    setDegreeFromEducation(best)
    if (!best) return // Giữ hồ sơ cũ nếu chưa có dữ liệu đào tạo.
    const fields = {
      academic_degree: best.degree,
      degree_year: Number(best.end_year),
      degree_country: best.country || null,
    }
    const { error } = await supabase.from('researchers').update(fields).eq('id', researcher.id)
    if (error) { setMsg('Không đồng bộ được học vị: ' + error.message); return }
    setF(prev => prev ? { ...prev, academic_degree: best.degree,
      degree_year: String(best.end_year), degree_country: best.country || '' } : prev)
  }

  if (!f || !researcher) return <main className="container page"><div className="empty">Đang tải...</div></main>

  const set = k => e => setF({ ...f, [k]: e.target.value })
  const setCap = k => e => setF({ ...f, [k]: liveCap(e.target.value) })
  const setFirst = k => e => setF({ ...f, [k]: capFirst(e.target.value) })
  const today = new Date().toISOString().slice(0, 10)
  // Mỗi tiêu chí lấy từ dữ liệu hồ sơ thực tế, không dựa vào học vị tự gõ.
  const guestSubjects = Array.isArray(f.guest_lecturing_subjects) ? f.guest_lecturing_subjects : []
  const completedDegree = highestCompletedDegree(educationRows)
  const acceptedDegrees = ['Thạc sĩ', 'Tiến sĩ', 'Tiến sĩ khoa học']
  const guestConditions = [
    { id: 'name', label: 'Họ và tên', detail: 'Đã khai báo họ tên đầy đủ', valid: String(f.full_name || '').trim().length >= 2, tab: 'personal' },
    { id: 'org', label: 'Đơn vị công tác', detail: 'Đã chọn đơn vị công tác trong hồ sơ', valid: Boolean(f.organization_id), tab: 'workplace' },
    { id: 'subjects', label: 'Ít nhất 1 môn giảng dạy', detail: 'Có tối thiểu một môn/chuyên đề có thể đảm nhận', valid: guestSubjects.length > 0, tab: 'extras' },
    { id: 'degree', label: 'Học vị từ Thạc sĩ trở lên', detail: 'Có bằng tốt nghiệp Thạc sĩ/Tiến sĩ trong quá trình đào tạo', valid: acceptedDegrees.includes(completedDegree?.degree), tab: 'education' },
  ]
  const guestEligible = guestConditions.every(c => c.valid)
  const guestMissing = guestConditions.filter(c => !c.valid).length
  function addGuestSubject() {
    const value = guestSubjectDraft.trim().replace(/\s+/g, ' ')
    if (!value || value.length > 150) return
    if (guestSubjects.some(subject => subject.toLocaleLowerCase('vi') === value.toLocaleLowerCase('vi'))) {
      setGuestSubjectDraft(''); return
    }
    setF(prev => ({ ...prev, guest_lecturing_subjects: [...(prev.guest_lecturing_subjects || []), value] }))
    setGuestSubjectDraft('')
  }
  function navigateGuestRequirement(tab) {
    setShowGuestEligibility(false)
    setActiveTab(tab)
    requestAnimationFrame(() => document.getElementById(`profile-tab-${tab}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }))
  }

  async function save(e) {
    e.preventDefault()
    setMsg('')
    if (f.available_guest_lecturing && !guestEligible) {
      setActiveTab('extras')
      setShowGuestEligibility(true)
      setMsg('Hồ sơ chưa đáp ứng đầy đủ các điều kiện đăng ký thỉnh giảng. Vui lòng bổ sung các mục còn thiếu.')
      return
    }
           const name = liveCap(f.full_name.trim().replace(/\s+/g, ' '))
    if (name.length < 2) { setMsg('Họ tên không được để trống.'); return }

    // Các trường lý lịch chính bắt buộc chọn đúng giá trị trong danh mục.
    if (!['Nam', 'Nữ', 'Khác'].includes(f.gender)) {
      setActiveTab('personal'); setMsg('Vui lòng chọn giới tính trong danh sách.'); return
    }
    if (!validCivilDate(f.birth_date)) {
      setActiveTab('personal'); setMsg('Ngày sinh đang trống hoặc chưa hợp lệ. Hãy kiểm tra ô Ngày sinh trong mục Thông tin cá nhân.'); return
    }
    if (!validProvince(f.birth_place)) {
      setActiveTab('personal'); setMsg('Nơi sinh chưa hợp lệ. Hãy gõ để tìm và chọn đúng tỉnh/thành phố trong danh sách gợi ý.'); return
    }
    if (!validProvince(f.hometown)) {
      setActiveTab('personal'); setMsg('Quê quán chưa hợp lệ. Hãy chọn đúng tỉnh/thành phố trong danh sách gợi ý.'); return
    }
    if (!f.ethnicity?.trim()) {
      setActiveTab('personal'); setMsg('Vui lòng chọn dân tộc.'); return
    }
    if (!f.nationality?.trim()) {
      setActiveTab('personal'); setMsg('Vui lòng nhập quốc tịch.'); return
    }
    let birthYear = null
    if (f.birth_date) {
      const d = new Date(f.birth_date)
      const age = new Date().getFullYear() - d.getFullYear()
      if (isNaN(d) || d > new Date() || age < 16 || d.getFullYear() < 1930) {
        setMsg('Ngày sinh chưa hợp lệ hoặc nằm ngoài khoảng được phép. Hãy kiểm tra ô Ngày sinh trong mục Thông tin cá nhân.'); return
      }
      birthYear = d.getFullYear()
    }
    const phone = cleanPhone(f.phone)
    const phoneO = cleanPhone(f.phone_office)
    const phoneH = cleanPhone(f.phone_home)

    if (!mobilePhoneOk(phone)) {
      setMsg('Số điện thoại di động phải gồm đúng 10 chữ số và bắt đầu bằng 0.')
      return
    }

    if (!phoneOk(phoneO) || !phoneOk(phoneH)) {
      setMsg('Số điện thoại cơ quan hoặc nhà riêng không hợp lệ.')
      return
    }

    const citizenId = String(f.citizen_id || '').replace(/\D/g, '')
    if (citizenId && !/^\d{12}$/.test(citizenId)) {
      setMsg('Số CCCD phải gồm đúng 12 chữ số.')
      return
    }

    if (citizenId && !f.citizen_id_issue_date) {
      setActiveTab('personal'); setMsg('Đã nhập số CCCD thì cần nhập ngày cấp CCCD.'); return
    }
    if (citizenId && !String(f.citizen_id_issued_by || '').trim()) {
      setActiveTab('personal'); setMsg('Vui lòng nhập cơ quan cấp CCCD.'); return
    }
    if (!citizenId && (f.citizen_id_issue_date || f.citizen_id_issued_by?.trim())) {
      // Mặc định cơ quan cấp được điền sẵn: không tính là đã khai CCCD.
      if (f.citizen_id_issue_date) {
        setActiveTab('personal'); setMsg('Có ngày cấp nhưng chưa nhập số CCCD.'); return
      }
    }
    if (f.citizen_id_issue_date) {
      const issueDate = new Date(`${f.citizen_id_issue_date}T00:00:00`)
      const todayDate = new Date()
      todayDate.setHours(23, 59, 59, 999)
      if (!validCivilDate(f.citizen_id_issue_date) || issueDate > todayDate || (f.birth_date && issueDate < new Date(`${f.birth_date}T00:00:00`))) {
        setMsg('Ngày cấp CCCD không hợp lệ.')
        return
      }
    }

    // PGS và GS là hai mốc công nhận độc lập; cấp cao nhất ghi ở bảng researchers.
    const currentYear = new Date().getFullYear()
    const pgsYear = f.associate_professor_year === '' ? null : Number(f.associate_professor_year)
    const gsYear = f.professor_year === '' ? null : Number(f.professor_year)
    if ([pgsYear, gsYear].some(year => year !== null && (!Number.isInteger(year) || year < 1900 || year > currentYear))) {
      setActiveTab('workplace'); setMsg('Năm công nhận Phó giáo sư/Giáo sư phải là năm hợp lệ.'); return
    }
    if (pgsYear != null && gsYear != null && gsYear < pgsYear) {
      setActiveTab('workplace'); setMsg('Năm công nhận Giáo sư không thể trước năm công nhận Phó giáo sư.'); return
    }
    const recognizedRank = gsYear != null ? 'Giáo sư' : (pgsYear != null ? 'Phó giáo sư' : '')
    const recognizedYear = gsYear ?? pgsYear
    const proYear = f.professional_title_year === '' ? null : Number(f.professional_title_year)
    if (f.professional_title && (proYear == null || !Number.isInteger(proYear) || proYear < 1900 || proYear > new Date().getFullYear())) {
      setMsg('Vui lòng nhập năm bổ nhiệm hợp lệ cho chức danh nghề nghiệp.'); return
    }
    if (proYear != null && !f.professional_title) { setMsg('Có năm bổ nhiệm nhưng chưa chọn chức danh nghề nghiệp.'); return }

    const warnings = academicWarnings({ birthDate: f.birth_date, education: educationRows,
      academicRank: recognizedRank, rankYear: recognizedYear, professionalYear: proYear })
    setEducationNotice(warnings)
    setSaving(true)
    const t = v => (String(v).trim() || null)
    const { error } = await supabase.from('researchers').update({
      full_name: name,
      gender: t(f.gender), birth_year: birthYear, nationality: t(f.nationality),
      position: t(f.position),
      academic_title: t(recognizedRank), title_year: recognizedYear,
      professional_title: t(f.professional_title), professional_title_year: num(f.professional_title_year),
      academic_degree: t(degreeFromEducation?.degree || f.academic_degree), degree_year: num(degreeFromEducation?.end_year || f.degree_year), degree_country: t(degreeFromEducation?.country || f.degree_country),
      organization_id: f.organization_id === '' ? null : Number(f.organization_id),
      contact_email: user.email, orcid: t(f.orcid),
      google_scholar_url: t(f.google_scholar_url), website: t(f.website),
      research_interests: t(f.research_interests),
      bio: t(f.bio), updated_at: new Date().toISOString(),
    }).eq('id', researcher.id)
    if (error) { setSaving(false); setMsg('Lỗi: ' + error.message); return }

    const priv = await supabase.from('researcher_private').upsert({
      researcher_id: researcher.id,
      citizen_id: citizenId || null,
      citizen_id_issue_date: f.citizen_id_issue_date || null,
      citizen_id_issued_by: t(f.citizen_id_issued_by),
      available_guest_lecturing: Boolean(f.available_guest_lecturing) && guestEligible,
      guest_lecturing_subjects: guestSubjects,
      available_business_consulting: Boolean(f.available_business_consulting),
      wants_research_collaboration: Boolean(f.wants_research_collaboration),
      available_committee_service: Boolean(f.available_committee_service),
      available_supervision: Boolean(f.available_supervision),
      associate_professor_year: pgsYear,
      professor_year: gsYear,
      birth_date: f.birth_date || null, birth_place: t(f.birth_place),
      hometown: t(f.hometown), ethnicity: t(f.ethnicity), address: t(f.address),
      phone: phone || null, phone_office: phoneO || null, phone_home: phoneH || null, fax: t(f.fax),
    }, { onConflict: 'researcher_id' })
    setSaving(false)
    if (priv.error) { setMsg('Lỗi: ' + priv.error.message); return }

    await reload()
    setMsg('Đã lưu thông tin.')
  }

  return (
    <main className="container page professional-profile">
      <div className="page-head row-between profile-hero">
        <div>
          <div className="profile-eyebrow">QUẢN LÝ THÔNG TIN CÁ NHÂN</div>
          <h1>Hồ sơ khoa học</h1>
          <p>Cập nhật thông tin chính xác để hiển thị hồ sơ và xuất CV khoa học. Các trường có biểu tượng khóa được bảo vệ theo phân quyền.</p>
        </div>
        <div className="actions">
          <ExportCvButton researcherId={researcher.id} />
          <Link to={`/researchers/${researcher.id}`} className="btn btn-ghost"><Eye size={16} /> Hồ sơ công khai</Link>
        </div>
      </div>

      {/* Thanh thao tác bám ngay dưới thanh điều hướng khi cuộn trang. */}
      <div className="profile-action-toolbar" aria-label="Thao tác hồ sơ">
        <div className="profile-action-context" aria-live="polite">
          {msg ? (
            <span role="status" className={msg.startsWith('Đã') ? 'profile-action-success' : 'profile-action-error'}>{msg}</span>
          ) : (
            <span><strong>Chỉnh sửa hồ sơ</strong><small>Lưu thông tin cá nhân và học thuật bất cứ lúc nào</small></span>
          )}
        </div>
        <button type="submit" form="profile-main-form" className="btn btn-primary profile-action-save" disabled={saving} aria-busy={saving}>
          <Save size={17} aria-hidden="true" /> {saving ? 'Đang lưu...' : 'Lưu thông tin'}
        </button>
      </div>

      {/* Chỉ một mục mở tại mỗi thời điểm. Trên điện thoại vuốt ngang để đổi mục. */}
      <nav className="profile-tab-strip" aria-label="Các nhóm thông tin hồ sơ">
        <div className="profile-tab-list" role="tablist" aria-label="Mục hồ sơ">
          {PROFILE_TABS.map(tab => (
            <button
              key={tab.id}
              type="button"
              id={`profile-tab-${tab.id}`}
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls={`profile-panel-${tab.id}`}
              className={`profile-tab-button ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="profile-tab-number">{tab.number}</span>
              {tab.label}
            </button>
          ))}
        </div>
        <p className="profile-tab-hint">Chọn từng mục để chỉnh sửa. Nội dung đã nhập được giữ lại khi chuyển mục.</p>
      </nav>

      <ProfileTabContext.Provider value={activeTab}>
      <form id="profile-main-form" onSubmit={save} className="profile-main-form">
        <Collapse id="personal" title="I. Lý lịch sơ lược" defaultOpen ctl={ctl}>
                    <AvatarUpload researcher={researcher} userId={user.id} onDone={reload} />
          <CvAttachmentUpload researcherId={researcher.id} userId={user.id} />
          <div className="form-grid profile-fields">
            <div className="profile-form-group-title"><span>01</span><div><strong>Thông tin cá nhân</strong><small>Họ tên, giới tính và ngày sinh</small></div></div>
            <label className="wide profile-name">Họ và tên *
              <input value={f.full_name} onChange={e => setF({ ...f, full_name: liveCap(e.target.value) })} placeholder="Nguyễn Văn A" />
            </label>
            <label className="profile-compact">Giới tính
              <select value={f.gender} onChange={set('gender')} required>
                <option value="">-- Chọn --</option>
                <option>Nam</option><option>Nữ</option><option>Khác</option>
              </select>
            </label>
            <label className="profile-compact"><span className="lock"><Lock size={12} /> Ngày sinh</span>
              <input type="date" value={f.birth_date} max={today} onChange={set('birth_date')} required />
            </label>
            <div className="profile-form-group-title"><span>02</span><div><strong>Giấy tờ định danh</strong><small>Thông tin chỉ hiển thị theo quyền truy cập</small></div></div>
            <label>
              <span className="lock"><Lock size={12} /> Số CCCD</span>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="off"
                maxLength={12}
                value={f.citizen_id || ''}
                placeholder="Nhập 12 chữ số"
                aria-invalid={Boolean(f.citizen_id && !/^\d{12}$/.test(f.citizen_id))}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 12)
                  setF(prev => ({ ...prev, citizen_id: digits }))
                }}
              />
              {f.citizen_id && !/^\d{12}$/.test(f.citizen_id) && (
                <small style={{ color: '#dc2626' }}>CCCD phải có đúng 12 chữ số.</small>
              )}
            </label>
            <label>
              <span className="lock"><Lock size={12} /> Ngày cấp CCCD</span>
              <input
                type="date"
                max={today}
                value={f.citizen_id_issue_date || ''}
                onChange={e => setF(prev => ({ ...prev, citizen_id_issue_date: e.target.value }))}
              />
            </label>
            <label>
              <span className="lock"><Lock size={12} /> Cơ quan cấp CCCD</span>
              <input
                value={f.citizen_id_issued_by || ''}
                onChange={e => setF(prev => ({ ...prev, citizen_id_issued_by: e.target.value }))}
                placeholder="Cục Cảnh sát quản lý hành chính về trật tự xã hội."
              />
            </label>
            <div className="profile-form-group-title"><span>03</span><div><strong>Quê quán và liên hệ</strong><small>Địa chỉ, số điện thoại và email</small></div></div>
            <ProvinceAutocomplete
              label="Nơi sinh (tỉnh/thành phố)"
              value={f.birth_place}
              onChange={value => setF(prev => ({ ...prev, birth_place: value }))}
            />
            <ProvinceAutocomplete
              label="Quê quán (tỉnh/thành phố)"
              value={f.hometown}
              onChange={value => setF(prev => ({ ...prev, hometown: value }))}
            />
            <label><span className="lock"><Lock size={12} /> Dân tộc</span>
              <select value={f.ethnicity} onChange={set('ethnicity')} required>
                <option value="">-- Chọn dân tộc --</option>
                {['Kinh','Tày','Thái','Mường','Khmer','Hoa','Nùng','Mông','Dao','Gia Rai','Ê Đê','Ba Na','Sán Chay','Chăm','Cơ Ho','Xơ Đăng','Sán Dìu','Hrê','Ra Glai','Mnông','Thổ','Stiêng','Khơ Mú','Bru-Vân Kiều','Giáy','Cơ Tu','Gié-Triêng','Mạ','Kháng','Co','Tà Ôi','Chơ Ro','Xinh Mun','Hà Nhì','Chu Ru','Lào','La Chí','La Ha','Phù Lá','La Hủ','Lự','Lô Lô','Chứt','Mảng','Pà Thẻn','Cờ Lao','Bố Y','Cống','Si La','Pu Péo','Rơ Măm','Brâu','Ơ Đu'].map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>Quốc tịch
              <input value={f.nationality} onChange={setCap('nationality')} />
            </label>
            <label className="wide geo-address-label"><span className="lock"><Lock size={12} /> Chỗ ở riêng hoặc địa chỉ liên lạc</span>
              <input
                ref={addressInputRef}
                value={f.address}
                onChange={e => {
                  const value = e.target.value
                  setF(prev => ({ ...prev, address: value }))
                  setSelectedPosition(null)
                  setAddressFocused(true)
                }}
                onFocus={() => setAddressFocused(true)}
                onBlur={() => setTimeout(() => setAddressFocused(false), 150)}
                onKeyDown={e => {
                  if (e.key === 'Escape') { setAddressSuggestions([]); setAddressFocused(false) }
                }}
                placeholder="Ví dụ: 1 Võ Văn Ngân, Thủ Đức, TP. Hồ Chí Minh"
                autoComplete="off"
                aria-autocomplete="list"
                aria-controls="geoapify-address-results"
                aria-expanded={addressFocused && addressSuggestions.length > 0}
              />
              {geoapifyKey ? (
                <>
                  {addressLoading && addressFocused && <small className="geo-address-note">Đang tìm địa chỉ…</small>}
                  {addressError && addressFocused && <small className="geo-address-warning">{addressError} Bạn vẫn có thể nhập tay.</small>}
                  {addressFocused && addressSuggestions.length > 0 && (
                    <div className="geo-address-results" role="listbox" id="geoapify-address-results" aria-label="Gợi ý địa chỉ Geoapify">
                      {addressSuggestions.map((place, index) => (
                        <button
                          key={`${place.place_id || place.formatted}-${index}`}
                          type="button"
                          role="option"
                          aria-selected="false"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => {
                            skipAddressSearchRef.current = true
                            setF(prev => ({ ...prev, address: place.formatted || place.address_line1 }))
                            setSelectedPosition(Number.isFinite(place.lat) && Number.isFinite(place.lon) ? { lat: place.lat, lon: place.lon } : null)
                            setAddressSuggestions([])
                            setAddressFocused(false)
                            addressInputRef.current?.blur()
                          }}
                          className="geo-address-option"
                        >
                          <strong>{place.address_line1 || place.formatted}</strong>
                          {place.address_line2 && <small>{place.address_line2}</small>}
                        </button>
                      ))}
                    </div>
                  )}
                  {selectedPosition && (
                    <a
                      className="geo-address-map"
                      href={`https://www.openstreetmap.org/?mlat=${selectedPosition.lat}&mlon=${selectedPosition.lon}#map=17/${selectedPosition.lat}/${selectedPosition.lon}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >Xem vị trí đã chọn trên bản đồ ↗</a>
                  )}
                  <small className="geo-address-note">Gợi ý địa chỉ bởi Geoapify · Có thể nhập thủ công nếu thiếu số nhà hoặc ngõ/hẻm.</small>
                </>
              ) : (
                <small className="geo-address-warning">Chưa cấu hình VITE_GEOAPIFY_API_KEY trong web/.env. Bạn vẫn có thể nhập địa chỉ thủ công.</small>
              )}
            </label>
            <label><span className="lock"><Lock size={12} /> Điện thoại cơ quan (CQ)</span>
              <input type="tel" value={f.phone_office} onChange={set('phone_office')} placeholder="Ví dụ: 02812345678" />
            </label>
            <label><span className="lock"><Lock size={12} /> Điện thoại nhà riêng (NR)</span>
              <input type="tel" value={f.phone_home} onChange={set('phone_home')} placeholder="Ví dụ: 02812345678" />
            </label>
            <label>
              <span className="lock"><Lock size={12} /> Điện thoại di động (DĐ)</span>
              <input
                type="tel"
                inputMode="numeric"
                autoComplete="tel-national"
                maxLength={10}
                value={f.phone}
                placeholder="0912345678"
                aria-invalid={Boolean(f.phone && !mobilePhoneOk(cleanPhone(f.phone)))}
                onChange={e => {
                  const digits = e.target.value.replace(/\D/g, '').slice(0, 10)
                  setF(prev => ({ ...prev, phone: digits }))
                }}
              />
              {f.phone && !mobilePhoneOk(cleanPhone(f.phone)) && (
                <small style={{ color: '#dc2626' }}>Nhập đủ 10 chữ số, bắt đầu bằng số 0.</small>
              )}
            </label>
            <label><span className="lock"><Lock size={12} /> Fax</span>
              <input value={f.fax} onChange={set('fax')} />
            </label>
            <label>Email liên hệ (công khai)
              <input type="email" value={user?.email || ''} readOnly aria-readonly="true" title="Email liên hệ đồng bộ từ tài khoản đăng nhập" />
              <small style={{ display: 'block', color: '#64748b', marginTop: 5 }}>Email này được đồng bộ từ tài khoản đăng nhập và không chỉnh sửa tại hồ sơ.</small>
            </label>
          </div>
        </Collapse>

        <Collapse id="workplace" title="Đơn vị, chức vụ, học hàm, học vị" ctl={ctl}>
          <p className="profile-section-intro">Thông tin chuyên môn phục vụ giới thiệu nhà khoa học và CV. Học vị cao nhất đồng bộ từ quá trình đào tạo đã khai báo.</p>
          <div className="form-grid profile-fields">
            <label>Đơn vị công tác
              <select value={f.organization_id} onChange={set('organization_id')}>
                <option value="">-- Chọn --</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="wide">Chức vụ (hiện tại hoặc trước khi nghỉ hưu)
              <input value={f.position} onChange={setCap('position')} placeholder="Trưởng bộ môn" />
            </label>
            <label>Chức danh nghề nghiệp (theo quyết định bổ nhiệm)
              <input
                type="text"
                list="professional-title-suggestions"
                value={f.professional_title || ''}
                onChange={set('professional_title')}
                placeholder="Ví dụ: Giảng viên, Nghiên cứu viên..."
                autoComplete="off"
                maxLength={120}
              />
              <datalist id="professional-title-suggestions">
                {PROFESSIONAL_TITLES.map(x => <option key={x} value={x} />)}
              </datalist>
            </label>
            <label>Năm bổ nhiệm chức danh nghề nghiệp
              <input type="number" min="1900" max={new Date().getFullYear()} value={f.professional_title_year} onChange={set('professional_title_year')} />
            </label>
            <label>Năm công nhận Phó giáo sư (nếu có)
              <input type="number" min="1900" max={new Date().getFullYear()} value={f.associate_professor_year} onChange={set('associate_professor_year')} placeholder="Ví dụ: 2020" />
            </label>
            <label>Năm công nhận Giáo sư (nếu có)
              <input type="number" min="1900" max={new Date().getFullYear()} value={f.professor_year} onChange={set('professor_year')} placeholder="Ví dụ: 2025" />
            </label>
            <p className="hint wide">Chỉ điền năm khi đã có quyết định công nhận học hàm tương ứng. Có thể ghi cả mốc PGS và GS; hệ thống tự hiển thị học hàm cao nhất trên hồ sơ.</p>
            <label>Học vị cao nhất (tự động)
              <input readOnly value={degreeFromEducation?.degree || f.academic_degree || 'Chưa khai báo'} />
            </label>
            <label>Năm cấp bằng (tự động)
              <input readOnly value={degreeFromEducation?.end_year || f.degree_year || ''} />
            </label>
            <label>Quốc gia cấp bằng (tự động)
              <input readOnly value={degreeFromEducation?.country || f.degree_country || ''} />
            </label>
            <p className="hint wide">Học hàm: chỉ Phó giáo sư/Giáo sư theo quyết định công nhận. Chức danh nghề nghiệp: giảng viên/nghiên cứu viên theo quyết định bổ nhiệm. Học vị: tự lấy từ quá trình đào tạo; không suy ra học hàm từ học vị. Những mốc thời gian bất thường chỉ được cảnh báo để đối chiếu giấy tờ.</p>
          </div>
          {academicWarnings({ birthDate: f.birth_date, education: educationRows,
            academicRank: f.professor_year ? 'Giáo sư' : (f.associate_professor_year ? 'Phó giáo sư' : ''), rankYear: f.professor_year || f.associate_professor_year,
            professionalYear: f.professional_title_year }).map((note, i) => (
            <p className="hint" key={i} role="status" style={{ color: '#a16207' }}>⚠ {note}</p>
          ))}
        </Collapse>

        <Collapse id="identity" title="Định danh khoa học và giới thiệu" ctl={ctl}>
          <p className="profile-section-intro">Các đường dẫn học thuật giúp người xem tìm được công bố và thông tin nghiên cứu của bạn.</p>
          <div className="form-grid profile-fields">
            <label>ORCID
              <input value={f.orcid} onChange={set('orcid')} placeholder="0000-0000-0000-0000" />
            </label>
            <label>Google Scholar
              <input value={f.google_scholar_url} onChange={set('google_scholar_url')} placeholder="https://scholar.google.com/..." />
            </label>
            <label>Website cá nhân
              <input value={f.website} onChange={set('website')} placeholder="https://..." />
            </label>
            <label className="wide">Lĩnh vực quan tâm (cách nhau bằng dấu phẩy)
              <input value={f.research_interests} onChange={set('research_interests')} placeholder="Trí tuệ nhân tạo, Học máy, Giáo dục số" />
            </label>
            <label className="wide">Tiểu sử tóm tắt
              <textarea rows={4} value={f.bio} onChange={setFirst('bio')} placeholder="Vài dòng giới thiệu về hướng nghiên cứu và thành tựu của bạn..." />
            </label>
          </div>
        </Collapse>


      </form>

      <ItemSection ctl={ctl}
        onItemsChanged={syncEducationDegree}
        validateCandidate={validateEducation} sortItems={sortEducation}
        id="education"
        title="II. Quá trình đào tạo"
        hint="Nhập theo quá trình thực tế. Năm bắt đầu không sau năm kết thúc; bậc cao hơn không được có năm cấp bằng sớm hơn bậc thấp hơn. Thực tập sau tiến sĩ không phải học vị. Danh sách và CV sẽ xếp từ cũ đến mới."
        table="researcher_education" rid={researcher.id} orderBy="end_year"
        fields={[
          { key: 'degree', label: 'Bậc đào tạo *', type: 'select', options: ['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Tiến sĩ khoa học', 'Thực tập sau tiến sĩ', 'Khác'] },
          { key: 'training_system', label: 'Hệ đào tạo', type: 'select', options: ['Chính quy', 'Vừa làm vừa học', 'Từ xa', 'Liên thông', 'Khác'] },
          { key: 'major', label: 'Ngành / chuyên ngành', placeholder: 'Khoa học máy tính' },
          { key: 'institution', label: 'Nơi đào tạo', placeholder: 'Đại học Bách khoa', wide: true },
          { key: 'country', label: 'Nước đào tạo', placeholder: 'Việt Nam' },
          { key: 'start_year', label: 'Từ năm', type: 'number' },
          { key: 'end_year', label: 'Năm tốt nghiệp / cấp bằng', type: 'number' },
          { key: 'thesis_title', label: 'Tên luận văn / luận án (nếu có)', wide: true },
        ]}
        render={i => ({
          main: `${i.degree}${i.major ? ' – ' + i.major : ''}`,
          sub: [i.institution, i.country, yearRange(i.start_year, i.end_year)].filter(Boolean).join(' • '),
          desc: i.thesis_title ? `Luận văn/luận án: ${i.thesis_title}` : '',
        })}
      />

      <ItemSection ctl={ctl}
        id="experience"
        title="III. Quá trình công tác chuyên môn" hint="Để trống 'Đến năm' nếu bạn vẫn đang làm việc ở đó."
        table="researcher_experience" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'position', label: 'Công việc đảm nhiệm *', placeholder: 'Giảng viên' },
          { key: 'organization', label: 'Đơn vị công tác', placeholder: 'Khoa CNTT, Đại học ...' },
          { key: 'start_year', label: 'Từ năm', type: 'number' },
          { key: 'end_year', label: 'Đến năm', type: 'number' },
          { key: 'description', label: 'Mô tả công việc', type: 'textarea', wide: true },
        ]}
        render={i => ({
          main: `${i.position}${i.organization ? ' – ' + i.organization : ''}`,
          sub: yearRange(i.start_year, i.end_year),
          desc: i.description,
        })}
      />

      <ItemSection ctl={ctl}
        id="projects"
        title="IV. Đề tài nghiên cứu khoa học đã và đang tham gia"
        table="researcher_projects" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'title', label: 'Tên đề tài *', wide: true },
          { key: 'start_year', label: 'Năm bắt đầu', type: 'number' },
          { key: 'end_year', label: 'Năm hoàn thành', type: 'number' },
          { key: 'level', label: 'Đề tài cấp', type: 'select', options: ['Nhà nước', 'Bộ', 'Ngành', 'Tỉnh/Thành phố', 'Trường', 'Cơ sở', 'Khác'] },
          { key: 'role', label: 'Trách nhiệm tham gia', type: 'select', options: ['Chủ nhiệm', 'Thư ký', 'Thành viên'] },
        ]}
        render={i => ({
          main: i.title,
          sub: [yearRange(i.start_year, i.end_year), i.level && `Cấp ${i.level}`, i.role].filter(Boolean).join(' • '),
        })}
      />

      <ItemSection ctl={ctl}
        id="awards"
        title="V. Khen thưởng và giải thưởng"
        table="researcher_awards" rid={researcher.id} orderBy="year"
        fields={[
          { key: 'title', label: 'Tên khen thưởng *', placeholder: 'Giải nhất sinh viên nghiên cứu khoa học', wide: true },
          { key: 'issuer', label: 'Đơn vị trao tặng' },
          { key: 'year', label: 'Năm', type: 'number' },
        ]}
        render={i => ({ main: i.title, sub: [i.issuer, i.year].filter(Boolean).join(' • ') })}
      />

      <ItemSection ctl={ctl}
        id="languages"
        title="VI. Ngoại ngữ" table="researcher_languages" rid={researcher.id} orderBy="id" asc
        hint="Chọn hoặc nhập ngôn ngữ, sau đó chọn chứng chỉ phù hợp. Bạn có thể nhập thêm điểm số, cấp độ hoặc trình độ sử dụng (ví dụ: IELTS Academic 7.0, JLPT N2). Chỉ khai chứng chỉ đã được cấp; nếu chưa có chứng chỉ, có thể ghi trình độ sử dụng thực tế."
        fields={[
          { key: 'language', label: 'Ngoại ngữ *', placeholder: 'Chọn hoặc nhập tên ngôn ngữ', suggestions: LANGUAGE_OPTIONS, preserveCase: true },
          { key: 'level', label: 'Chứng chỉ / cấp độ / mức độ sử dụng', placeholder: 'Ví dụ: IELTS Academic 7.0 hoặc JLPT N2', suggestions: draft => certificatesForLanguage(draft.language), preserveCase: true, wide: true },
        ]}
        render={i => ({ main: i.language, sub: i.level ? `Chứng chỉ / trình độ: ${i.level}` : '' })}
      />

      <Collapse id="extras" title="VII. Thỉnh giảng, tư vấn và hợp tác nghiên cứu" ctl={ctl}>
          <p className="muted">Đăng ký thỉnh giảng, tư vấn doanh nghiệp và kết nối cộng sự nghiên cứu tại cùng một nơi. Chỉ công khai thông tin hợp tác khi bạn chủ động lựa chọn.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <div className="guest-lecture-box">
              <div className="guest-lecture-heading">
                <div><strong>Đăng ký tham gia thỉnh giảng</strong>
                  <p>Hồ sơ cần đáp ứng 4 tiêu chí để bật trạng thái sẵn sàng thỉnh giảng.</p></div>
                <button type="button" className="guest-lecture-check" onClick={() => setShowGuestEligibility(true)}>Kiểm tra điều kiện</button>
              </div>
              <label className="guest-lecture-switch">
                <input type="checkbox" checked={Boolean(f.available_guest_lecturing)}
                  onChange={e => {
                    if (!e.target.checked) { setF(prev => ({ ...prev, available_guest_lecturing: false })); return }
                    if (!guestEligible) { setShowGuestEligibility(true); return }
                    setF(prev => ({ ...prev, available_guest_lecturing: true }))
                  }} />
                Tôi sẵn sàng thỉnh giảng
              </label>
              <div className="guest-lecture-status" role="status">
                {guestEligible ? 'Đã đáp ứng 4/4 điều kiện. Bạn có thể bật đăng ký thỉnh giảng.'
                  : `Đã đáp ứng ${4 - guestMissing}/4 điều kiện. Còn thiếu ${guestMissing} điều kiện.`}
              </div>
              <div className="guest-lecture-subjects">
                <label htmlFor="guest-lecture-subject">Môn học / chuyên đề có thể giảng dạy</label>
                <div className="guest-lecture-entry">
                  <input id="guest-lecture-subject" value={guestSubjectDraft}
                    placeholder="Ví dụ: Trí tuệ nhân tạo, Lập trình Python..." maxLength={150}
                    onChange={e => setGuestSubjectDraft(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addGuestSubject() } }} />
                  <button type="button" className="guest-lecture-add" onClick={addGuestSubject}>Thêm môn</button>
                </div>
                {guestSubjects.length > 0 && <div className="guest-lecture-chips">
                  {guestSubjects.map(subject => <span className="guest-lecture-chip" key={subject}>{subject}
                    <button type="button" aria-label={`Xóa môn ${subject}`} title="Xóa môn"
                      onClick={() => setF(prev => ({ ...prev,
                        guest_lecturing_subjects: prev.guest_lecturing_subjects.filter(x => x !== subject),
                        available_guest_lecturing: prev.guest_lecturing_subjects.length > 1 && prev.available_guest_lecturing,
                      }))}>×</button>
                  </span>)}
                </div>}
                <small>Môn giảng dạy sẽ được lưu khi bạn bấm “Lưu thông tin” ở góc phải.</small>
              </div>
            </div>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={Boolean(f.available_business_consulting)}
                onChange={e => setF(prev => ({ ...prev, available_business_consulting: e.target.checked }))}
                style={{ width: 18, height: 18, flex: '0 0 18px' }} />
              Tôi sẵn sàng tư vấn doanh nghiệp
            </label>
            <fieldset className="profile-collab-options">
              <legend>Nhu cầu hợp tác và hoạt động học thuật</legend>
              {[
                ['wants_research_collaboration', 'Tôi muốn tìm cộng sự nghiên cứu', 'Cho phép người dùng đã đăng nhập tìm thấy hồ sơ học thuật công khai của bạn để hợp tác nghiên cứu.'],
                ['available_committee_service', 'Đồng ý tham gia hội đồng', 'Sẵn sàng nhận lời mời hội đồng phù hợp chuyên môn.'],
                ['available_supervision', 'Đồng ý làm người hướng dẫn', 'Sẵn sàng hướng dẫn học tập, nghiên cứu theo điều kiện của đơn vị.'],
              ].map(([field, title, description]) => (
                <label className="profile-collab-option" key={field}>
                  <input type="checkbox" checked={Boolean(f[field])}
                    onChange={e => setF(prev => ({ ...prev, [field]: e.target.checked }))} />
                  <span><strong>{title}</strong><small>{description}</small></span>
                </label>
              ))}
              <p className="hint">Đánh dấu thể hiện nguyện vọng hợp tác; không đồng nghĩa với việc được bổ nhiệm hoặc được giao nhiệm vụ chính thức.</p>
              <Link to="/collaboration" className="btn btn-ghost" style={{ display: 'inline-flex', width: 'fit-content', marginTop: 10 }}>
                Tìm cộng sự phù hợp →
              </Link>
            </fieldset>
          </div>
        </Collapse>
      </ProfileTabContext.Provider>

      {showGuestEligibility && <div className="guest-eligibility-overlay" onMouseDown={e => { if (e.target === e.currentTarget) setShowGuestEligibility(false) }}>
        <div className="guest-eligibility-dialog" role="dialog" aria-modal="true" aria-labelledby="guest-eligibility-title">
          <div className="guest-eligibility-titlebar">
            <div><span className="guest-eligibility-kicker">ĐĂNG KÝ THỈNH GIẢNG</span>
              <h2 id="guest-eligibility-title">Kiểm tra điều kiện hồ sơ</h2></div>
            <button type="button" aria-label="Đóng" className="guest-dialog-close" onClick={() => setShowGuestEligibility(false)}>×</button>
          </div>
          <div className="guest-eligibility-content">
            <p className="guest-eligibility-lead">{guestEligible
              ? 'Hồ sơ đã đáp ứng đầy đủ các tiêu chí đăng ký thỉnh giảng.'
              : `Hồ sơ chưa đủ điều kiện đăng ký thỉnh giảng (còn thiếu ${guestMissing} tiêu chí). Hãy bổ sung các thông tin được đánh dấu bên dưới.`}</p>
            <div className="guest-eligibility-progress" aria-label={`${4 - guestMissing} trên 4 điều kiện đã hoàn thành`}>
              <span style={{ width: `${(4 - guestMissing) * 25}%` }} /></div>
            <div className="guest-eligibility-list">
              {guestConditions.map(condition => <div key={condition.id} className={`guest-eligibility-item ${condition.valid ? 'is-ok' : 'is-missing'}`}>
                <span className="guest-condition-icon" aria-hidden="true">{condition.valid ? '✓' : '!'}</span>
                <div><strong>{condition.label}</strong><small>{condition.detail}</small></div>
                {!condition.valid && <button type="button" onClick={() => navigateGuestRequirement(condition.tab)}>Bổ sung <span aria-hidden="true">→</span></button>}
              </div>)}
            </div>
            <p className="guest-eligibility-disclaimer">Đây là tiêu chí sàng lọc hồ sơ của UTEProfile, không thay thế quy trình tuyển chọn hoặc quy định thỉnh giảng chính thức của đơn vị.</p>
          </div>
          <div className="guest-eligibility-footer"><button type="button" onClick={() => setShowGuestEligibility(false)}>Đóng</button>
            {guestEligible && <button type="button" className="guest-dialog-primary" onClick={() => {
              setF(prev => ({ ...prev, available_guest_lecturing: true }))
              setShowGuestEligibility(false)
              setActiveTab('extras')
            }}>Đăng ký thỉnh giảng</button>}
          </div>
        </div>
      </div>}

        <p className="hint profile-save-note">
          <strong>Lưu ý:</strong> Nút “Lưu thông tin” ở góc trên bên phải lưu thông tin cá nhân, học hàm, học vị và lựa chọn chuyên môn.
          Các dòng đào tạo, công tác, đề tài được lưu riêng khi bạn nhấn “Thêm mục”.
        </p>

      <p className="hint" style={{ marginTop: 18 }}>
        Công trình công bố trong CV được lấy tự động từ các bài <b>đã được duyệt</b> của bạn.
      </p>
    </main>
  )
}