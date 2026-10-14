import { useUI } from '../ui'
import AvatarUpload from '../components/AvatarUpload'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Trash2, Eye, Lock, ChevronDown } from 'lucide-react'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { liveCap, titleCase, capFirst } from '../utils'
import ExportCvButton from '../components/ExportCvButton'

const yearRange = (a, b) => (a ? `${a} – ${b || 'nay'}` : '')
const num = v => (v === '' || v == null ? null : parseInt(v, 10))
const cleanPhone = s => String(s || '').replace(/[\s.\-]/g, '')
const mobilePhoneOk = s => !s || /^0\d{9}$/.test(s)
const phoneOk = s => !s || /^(0|\+84)\d{9,10}$/.test(s)

// Gợi ý tỉnh/thành phố; người dùng vẫn có thể nhập địa danh khác.
const vietnamProvinces = [
  'An Giang', 'Bắc Ninh', 'Cà Mau', 'Cao Bằng', 'Đắk Lắk', 'Điện Biên',
  'Đồng Nai', 'Đồng Tháp', 'Gia Lai', 'Hà Nội', 'Hà Tĩnh', 'Hải Phòng',
  'Hưng Yên', 'Khánh Hòa', 'Lai Châu', 'Lâm Đồng', 'Lạng Sơn', 'Lào Cai',
  'Nghệ An', 'Ninh Bình', 'Phú Thọ', 'Quảng Ngãi', 'Quảng Ninh', 'Quảng Trị',
  'Sơn La', 'Tây Ninh', 'Thái Nguyên', 'Thanh Hóa', 'Thành phố Đà Nẵng',
  'Thành phố Hồ Chí Minh', 'Thành phố Huế', 'Tuyên Quang', 'Vĩnh Long',
  'Thành phố Cần Thơ',
]

// Mục có thể bung ra / thu lại
function Collapse({ title, count, defaultOpen = false, ctl, children }) {
  const [open, setOpen] = useState(defaultOpen)
  useEffect(() => { if (ctl && ctl.n > 0) setOpen(ctl.open) }, [ctl])
  return (
    <section className={`form-card acc ${open ? 'open' : ''}`}>
      <button type="button" className="acc-head" onClick={() => setOpen(!open)} aria-expanded={open}>
        <span className="acc-title">{title}</span>
        {count != null && <em className="acc-count">{count}</em>}
        <ChevronDown size={20} className="acc-chev" />
      </button>
      <div className="acc-body" hidden={!open}>{children}</div>
    </section>
  )
}

function ItemSection({ title, hint, table, rid, fields, orderBy, asc, render, ctl }) {
  const blank = Object.fromEntries(fields.map(f => [f.key, '']))
  const [items, setItems] = useState([])
  const [draft, setDraft] = useState(blank)
  const [err, setErr] = useState('')
  const { confirm } = useUI()

  async function load() {
    const { data } = await supabase.from(table).select('*')
      .eq('researcher_id', rid).order(orderBy, { ascending: !!asc })
    setItems(data || [])
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
    const { error } = await supabase.from(table).insert(row)
    if (error) { setErr(error.message); return }
    setErr(''); setDraft(blank); load()
  }

  async function remove(id) {
           if (!(await confirm({ title: 'Xóa mục này?', message: 'Thao tác này không thể hoàn tác.', confirmText: 'Xóa', danger: true }))) return
    await supabase.from(table).delete().eq('id', id)
    load()
  }

  return (
    <Collapse title={title} count={items.length} ctl={ctl}>
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
                <input type={f.type || 'text'} value={draft[f.key]} placeholder={f.placeholder}
                  onChange={e => setDraft({ ...draft, [f.key]: f.type === 'number' ? e.target.value : liveCap(e.target.value) })} />
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
  const [msg, setMsg] = useState('')
  const [saving, setSaving] = useState(false)
  const [ctl, setCtl] = useState({ open: false, n: 0 })
  const [addressSuggestions, setAddressSuggestions] = useState([])
  const [addressLoading, setAddressLoading] = useState(false)
  const addressInputRef = useRef(null)

  useEffect(() => { if (ready && !user) navigate('/login') }, [ready, user, navigate])

  // Gợi ý địa chỉ hành chính Việt Nam miễn phí, không cần API key.
  // API gợi ý tỉnh/thành và phường/xã; không thay thế tìm số nhà/toạ độ như Google Maps.
  useEffect(() => {
    const query = String(f?.address || '').trim()
    if (query.length < 2) {
      setAddressSuggestions([])
      setAddressLoading(false)
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setAddressLoading(true)
      try {
        const url = `https://tinhthanhpho.com/api/v1/suggest?q=${encodeURIComponent(query)}&limit=6`
        const response = await fetch(url, { headers: { Accept: 'application/json' } })
        if (!response.ok) throw new Error('Không lấy được gợi ý địa chỉ')
        const payload = await response.json()
        const rows = Array.isArray(payload) ? payload : (payload.data?.items || payload.items || payload.data || [])
        const suggestions = rows.map(item => {
          if (typeof item === 'string') return item
          return item.label || item.display || item.full_name || item.name || ''
        }).filter(Boolean).slice(0, 6)
        if (!cancelled) setAddressSuggestions([...new Set(suggestions)])
      } catch {
        if (!cancelled) setAddressSuggestions([])
      } finally {
        if (!cancelled) setAddressLoading(false)
      }
    }, 300)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [f?.address])

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
        contact_email: researcher.contact_email || '',
        position: researcher.position || '',
        academic_title: researcher.academic_title || '',
        title_year: researcher.title_year || '',
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
        available_business_consulting: pr?.available_business_consulting ?? false,
      }))
  }, [researcher])

  useEffect(() => {
    supabase.from('organizations').select('id,name').order('id').then(({ data }) => setOrgs(data || []))
  }, [])

  if (!f || !researcher) return <main className="container page"><div className="empty">Đang tải...</div></main>

  const set = k => e => setF({ ...f, [k]: e.target.value })
  const setCap = k => e => setF({ ...f, [k]: liveCap(e.target.value) })
  const setFirst = k => e => setF({ ...f, [k]: capFirst(e.target.value) })
  const today = new Date().toISOString().slice(0, 10)

  async function save(e) {
    e.preventDefault()
    setMsg('')
           const name = liveCap(f.full_name.trim().replace(/\s+/g, ' '))
    if (name.length < 2) { setMsg('Họ tên không được để trống.'); return }

    let birthYear = null
    if (f.birth_date) {
      const d = new Date(f.birth_date)
      const age = new Date().getFullYear() - d.getFullYear()
      if (isNaN(d) || d > new Date() || age < 16 || d.getFullYear() < 1930) {
        setMsg('Ngày sinh không hợp lệ.'); return
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

    if (f.citizen_id_issue_date) {
      const issueDate = new Date(`${f.citizen_id_issue_date}T00:00:00`)
      const todayDate = new Date()
      todayDate.setHours(23, 59, 59, 999)
      if (isNaN(issueDate.getTime()) || issueDate > todayDate) {
        setMsg('Ngày cấp CCCD không hợp lệ.')
        return
      }
    }

    setSaving(true)
    const t = v => (String(v).trim() || null)
    const { error } = await supabase.from('researchers').update({
      full_name: name,
      gender: t(f.gender), birth_year: birthYear, nationality: t(f.nationality),
      position: t(f.position),
      academic_title: t(f.academic_title), title_year: num(f.title_year),
      academic_degree: t(f.academic_degree), degree_year: num(f.degree_year), degree_country: t(f.degree_country),
      organization_id: f.organization_id === '' ? null : Number(f.organization_id),
      contact_email: t(f.contact_email), orcid: t(f.orcid),
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
      available_guest_lecturing: Boolean(f.available_guest_lecturing),
      available_business_consulting: Boolean(f.available_business_consulting),
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
    <main className="container page">
      <div className="page-head row-between">
        <div>
          <h1>Hồ sơ khoa học của tôi</h1>
          <p>Điền đầy đủ để xuất lý lịch khoa học (Phụ lục III). Mục có biểu tượng khóa chỉ bạn và quản trị viên xem được.</p>
        </div>
        <div className="actions">
          <ExportCvButton researcherId={researcher.id} />
          <Link to={`/researchers/${researcher.id}`} className="btn btn-ghost"><Eye size={16} /> Hồ sơ công khai</Link>
        </div>
      </div>

      <div className="acc-tools">
        <button type="button" className="link-btn" onClick={() => setCtl(c => ({ open: true, n: c.n + 1 }))}>Mở tất cả</button>
        <button type="button" className="link-btn" onClick={() => setCtl(c => ({ open: false, n: c.n + 1 }))}>Thu gọn tất cả</button>
      </div>

      <form onSubmit={save}>
        <Collapse title="I. Lý lịch sơ lược" defaultOpen ctl={ctl}>
                    <AvatarUpload researcher={researcher} userId={user.id} onDone={reload} />
          <div className="form-grid">
            <label className="wide">Họ và tên *
              <input value={f.full_name} onChange={e => setF({ ...f, full_name: liveCap(e.target.value) })} placeholder="Nguyễn Văn A" />
            </label>
            <label style={{ maxWidth: 240 }}>Giới tính
              <select value={f.gender} onChange={set('gender')}>
                <option value="">-- Chọn --</option>
                <option>Nam</option><option>Nữ</option><option>Khác</option>
              </select>
            </label>
            <label style={{ maxWidth: 240 }}><span className="lock"><Lock size={12} /> Ngày sinh</span>
              <input type="date" value={f.birth_date} max={today} onChange={set('birth_date')} />
            </label>
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
            <label>
              <span className="lock"><Lock size={12} /> Nơi sinh</span>
              <input
                list="vietnam-provinces"
                value={f.birth_place}
                onChange={setCap('birth_place')}
                placeholder="Nhập tỉnh/thành phố"
                autoComplete="off"
              />
            </label>
            <label>
              <span className="lock"><Lock size={12} /> Quê quán</span>
              <input
                list="vietnam-provinces"
                value={f.hometown}
                onChange={setCap('hometown')}
                placeholder="Nhập tỉnh/thành phố"
                autoComplete="off"
              />
            </label>
            <datalist id="vietnam-provinces">
              {vietnamProvinces.map(province => (
                <option key={province} value={province} />
              ))}
            </datalist>
            <label><span className="lock"><Lock size={12} /> Dân tộc</span>
              <select value={f.ethnicity} onChange={set('ethnicity')}>
                <option value="">-- Chọn dân tộc --</option>
                {['Kinh','Tày','Thái','Mường','Khmer','Hoa','Nùng','Mông','Dao','Gia Rai','Ê Đê','Ba Na','Sán Chay','Chăm','Cơ Ho','Xơ Đăng','Sán Dìu','Hrê','Ra Glai','Mnông','Thổ','Stiêng','Khơ Mú','Bru-Vân Kiều','Giáy','Cơ Tu','Gié-Triêng','Mạ','Kháng','Co','Tà Ôi','Chơ Ro','Xinh Mun','Hà Nhì','Chu Ru','Lào','La Chí','La Ha','Phù Lá','La Hủ','Lự','Lô Lô','Chứt','Mảng','Pà Thẻn','Cờ Lao','Bố Y','Cống','Si La','Pu Péo','Rơ Măm','Brâu','Ơ Đu'].map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>Quốc tịch
              <input value={f.nationality} onChange={setCap('nationality')} />
            </label>
            <label className="wide"><span className="lock"><Lock size={12} /> Chỗ ở riêng hoặc địa chỉ liên lạc</span>
              <input ref={addressInputRef} value={f.address} onChange={setCap('address')} placeholder="Nhập địa chỉ, phường/xã hoặc tỉnh/thành" autoComplete="off" aria-autocomplete="list" />
              {addressLoading && <small style={{ color: '#64748b' }}>Đang tìm gợi ý địa chỉ…</small>}
              {addressSuggestions.length > 0 && (
                <div role="listbox" aria-label="Gợi ý địa chỉ" style={{ marginTop: 6, border: '1px solid #dbe3ef', borderRadius: 10, background: '#fff', boxShadow: '0 8px 20px rgba(15,23,42,.08)', overflow: 'hidden' }}>
                  {addressSuggestions.map((suggestion, index) => (
                    <button
                      type="button"
                      role="option"
                      aria-selected="false"
                      key={`${suggestion}-${index}`}
                      onClick={() => {
                        setF(prev => ({ ...prev, address: suggestion }))
                        setAddressSuggestions([])
                      }}
                      style={{ display: 'block', width: '100%', padding: '10px 12px', textAlign: 'left', border: 0, borderBottom: index === addressSuggestions.length - 1 ? 0 : '1px solid #eef2f7', background: '#fff', cursor: 'pointer', color: '#1e293b' }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              )}
              <small style={{ color: '#64748b' }}>Gợi ý miễn phí cho đơn vị hành chính Việt Nam; bạn vẫn có thể tự nhập số nhà và tên đường.</small>
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
              <input type="email" value={f.contact_email} onChange={set('contact_email')} />
            </label>
          </div>
        </Collapse>

        <Collapse title="Đơn vị, chức vụ, học hàm, học vị" ctl={ctl}>
          <div className="form-grid">
            <label>Đơn vị công tác
              <select value={f.organization_id} onChange={set('organization_id')}>
                <option value="">-- Chọn --</option>
                {orgs.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
            </label>
            <label className="wide">Chức vụ (hiện tại hoặc trước khi nghỉ hưu)
              <input value={f.position} onChange={setCap('position')} placeholder="Trưởng bộ môn" />
            </label>
            <label>Chức danh khoa học cao nhất
              <select value={f.academic_title} onChange={set('academic_title')}>
                <option value="">-- Chọn --</option>
                {['Trợ giảng', 'Giảng viên', 'Giảng viên chính', 'Nghiên cứu viên', 'Phó giáo sư', 'Giáo sư'].map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>Năm bổ nhiệm
              <input type="number" value={f.title_year} onChange={set('title_year')} />
            </label>
            <span />
            <label>Học vị cao nhất
              <select value={f.academic_degree} onChange={set('academic_degree')}>
                <option value="">-- Chọn --</option>
                {['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Tiến sĩ khoa học'].map(x => <option key={x}>{x}</option>)}
              </select>
            </label>
            <label>Năm nhận học vị
              <input type="number" value={f.degree_year} onChange={set('degree_year')} />
            </label>
            <label>Nước nhận học vị
              <input value={f.degree_country} onChange={setCap('degree_country')} placeholder="Việt Nam" />
            </label>
          </div>
        </Collapse>

        <Collapse title="Định danh khoa học và giới thiệu" ctl={ctl}>
          <div className="form-grid">
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

        <Collapse title="IV. Hoạt động chuyên môn bổ sung" ctl={ctl}>
          <p className="muted">Thông tin này hiển thị với chính bạn và quản trị viên để hỗ trợ kết nối chuyên môn.</p>
          <div style={{ display: 'grid', gap: 12, marginTop: 14 }}>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={Boolean(f.available_guest_lecturing)}
                onChange={e => setF(prev => ({ ...prev, available_guest_lecturing: e.target.checked }))}
                style={{ width: 18, height: 18, flex: '0 0 18px' }} />
              Tôi sẵn sàng thỉnh giảng
            </label>
            <label style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <input type="checkbox" checked={Boolean(f.available_business_consulting)}
                onChange={e => setF(prev => ({ ...prev, available_business_consulting: e.target.checked }))}
                style={{ width: 18, height: 18, flex: '0 0 18px' }} />
              Tôi sẵn sàng tư vấn doanh nghiệp
            </label>
          </div>
        </Collapse>

        {msg && <div className={msg.startsWith('Đã') ? 'ok-msg' : 'auth-error'} style={{ marginTop: 16 }}>{msg}</div>}
        <div className="save-bar">
          <button className="btn btn-primary" disabled={saving}>{saving ? 'Đang lưu...' : 'Lưu thông tin'}</button>
          <span className="hint">Nhấn lưu để cập nhật các mục phía trên (I, đơn vị, định danh).</span>
        </div>
      </form>

      <ItemSection ctl={ctl}
        title="II. Quá trình đào tạo"
        hint="Đại học: chọn Cử nhân/Kỹ sư (nhập bằng thứ hai nếu có). Sau đại học: chọn Thạc sĩ, Tiến sĩ và nhập tên luận văn/luận án."
        table="researcher_education" rid={researcher.id} orderBy="end_year"
        fields={[
          { key: 'degree', label: 'Bậc đào tạo *', type: 'select', options: ['Cử nhân', 'Kỹ sư', 'Thạc sĩ', 'Tiến sĩ', 'Thực tập sau tiến sĩ', 'Khác'] },
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
        title="Ngoại ngữ" table="researcher_languages" rid={researcher.id} orderBy="id" asc
        fields={[
          { key: 'language', label: 'Ngoại ngữ *', placeholder: 'Tiếng Anh' },
          { key: 'level', label: 'Mức độ sử dụng', placeholder: 'Tốt (IELTS 7.0)' },
        ]}
        render={i => ({ main: i.language, sub: i.level ? `Mức độ sử dụng: ${i.level}` : '' })}
      />

      <ItemSection ctl={ctl}
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
        title="IV. Đề tài nghiên cứu khoa học đã và đang tham gia"
        table="researcher_projects" rid={researcher.id} orderBy="start_year"
        fields={[
          { key: 'title', label: 'Tên đề tài *', wide: true },
          { key: 'start_year', label: 'Năm bắt đầu', type: 'number' },
          { key: 'end_year', label: 'Năm hoàn thành', type: 'number' },
          { key: 'level', label: 'Đề tài cấp', type: 'select', options: ['Nhà nước', 'Bộ', 'Ngành', 'Tỉnh/Thành phố', 'Trường', 'Cơ sở', 'Khác'] },
          { key: 'role', label: 'Trách nhiệm tham gia', type: 'select', options: ['Chủ nhiệm', 'Phó chủ nhiệm', 'Thư ký', 'Thành viên chính', 'Thành viên'] },
        ]}
        render={i => ({
          main: i.title,
          sub: [yearRange(i.start_year, i.end_year), i.level && `Cấp ${i.level}`, i.role].filter(Boolean).join(' • '),
        })}
      />

      <ItemSection ctl={ctl}
        title="Khen thưởng và giải thưởng"
        table="researcher_awards" rid={researcher.id} orderBy="year"
        fields={[
          { key: 'title', label: 'Tên khen thưởng *', placeholder: 'Giải nhất sinh viên nghiên cứu khoa học', wide: true },
          { key: 'issuer', label: 'Đơn vị trao tặng' },
          { key: 'year', label: 'Năm', type: 'number' },
        ]}
        render={i => ({ main: i.title, sub: [i.issuer, i.year].filter(Boolean).join(' • ') })}
      />

      <p className="hint" style={{ marginTop: 18 }}>
        Công trình công bố trong CV được lấy tự động từ các bài <b>đã được duyệt</b> của bạn.
      </p>
    </main>
  )
}