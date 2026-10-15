import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Check, X, ShieldCheck, Users, FileClock, ScrollText, Trash2, Search, LayoutDashboard, BookOpen, ChartNoAxesCombined, BriefcaseBusiness, FileWarning, RefreshCw, Download, CalendarDays, ChevronRight, Filter, ExternalLink, UserRoundCheck, Clock3 } from 'lucide-react'
import './AdminProfessional.css'
import { supabase } from '../supabase'
import { useAuth } from '../AuthContext'
import { useUI } from '../ui'
import { approvePub } from '../review'
import Loading from '../components/Loading'
import ExportCvButton from '../components/ExportCvButton'

const typeNames = {
  JOURNAL: 'Bài báo', CONFERENCE: 'Hội nghị', BOOK: 'Sách',
  BOOK_CHAPTER: 'Chương sách', THESIS: 'Luận văn', RESEARCH_PROJECT: 'Đề tài', OTHER: 'Khác',
}
const statusName = { DRAFT: 'Bản nháp', PENDING: 'Chờ duyệt', APPROVED: 'Đã công khai', REJECTED: 'Bị từ chối', ARCHIVED: 'Lưu trữ' }
const statusCls = { DRAFT: 's-draft', PENDING: 's-pending', APPROVED: 's-ok', REJECTED: 's-bad', ARCHIVED: 's-draft' }
const fmt = d => new Date(d).toLocaleString('vi-VN')
const clean = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase()

export default function Admin() {
  const { user, profile, isAdmin, ready } = useAuth()
  const { confirm, prompt, toast } = useUI()
  const navigate = useNavigate()
  const [tab, setTab] = useState('overview')
  const [pending, setPending] = useState([])
  const [allPubs, setAllPubs] = useState([])
  const [users, setUsers] = useState([])
  const [logs, setLogs] = useState([])
  const [stats, setStats] = useState({})
  const [q, setQ] = useState('')
  const [st, setSt] = useState('')
  const [interest, setInterest] = useState([])
  const [interestFilter, setInterestFilter] = useState('all')
  const [userSearch, setUserSearch] = useState('')
  const [yearQuarter, setYearQuarter] = useState('')
  const [loadError, setLoadError] = useState('')
  const [periodMode, setPeriodMode] = useState('month')
  const [reportYear, setReportYear] = useState('all')
  const [reportMonth, setReportMonth] = useState('all')
  const [reportQuarter, setReportQuarter] = useState('all')
  const [reportPerson, setReportPerson] = useState('all')
  const [reportSearch, setReportSearch] = useState('')
  const [reportStatus, setReportStatus] = useState('all')
  const [reportType, setReportType] = useState('all')
  const [reportPage, setReportPage] = useState(1)
  const [busy, setBusy] = useState(false)
  const [loadedAt, setLoadedAt] = useState(null)
  const [reportCount, setReportCount] = useState(null)

  useEffect(() => {
    if (!ready) return
    if (!user) navigate('/login')
    else if (profile && !isAdmin) navigate('/')
  }, [ready, user, profile, isAdmin, navigate])

  async function loadAll() {
    setLoadError('')
    setBusy(true)
    const [p, u, l, a, pe, us, ap, interests, total] = await Promise.all([
      supabase.from('publications')
        .select('id,title,abstract,doi,created_by,publication_type,publication_year,journal,created_at,publication_authors(author_order,researchers(full_name))')
        .eq('status', 'PENDING').order('created_at'),
      supabase.from('profiles').select('id,email,role,created_at,researchers(id,full_name)').order('created_at', { ascending: false }),
      supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'APPROVED'),
      supabase.from('publications').select('*', { count: 'exact', head: true }).eq('status', 'PENDING'),
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase.from('publications')
        .select('id,title,doi,created_by,status,publication_type,publication_year,created_at,pdf_url,publication_authors(author_order,researchers(full_name))')
        .order('created_at', { ascending: false }).range(0, 1999),
      supabase.rpc('admin_interest_flags'),
      supabase.from('publications').select('*', { count: 'exact', head: true }),
    ])
    setPending(p.data || []); setUsers(u.data || []); setLogs(l.data || []); setAllPubs(ap.data || [])
    setStats({ approved: a.count, pending: pe.count, users: us.count })
    setReportCount(total.count ?? null)
    setLoadedAt(new Date())
    setBusy(false)
    setInterest(interests.data || [])
    const errors = [p, u, ap, interests, total].filter(x => x.error).map(x => x.error.message)
    if (errors.length) setLoadError(errors.join(' • '))
  }
  useEffect(() => { if (isAdmin) loadAll() }, [isAdmin])

  const log = (action, type, eid, oldV, newV) =>
    supabase.from('audit_logs').insert({
      user_id: user.id, action, entity_type: type, entity_id: String(eid), old_value: oldV, new_value: newV,
    })

  async function approve(p) {
    try {
      const c = await approvePub(p, user.id)
      toast(c != null ? `Đã duyệt công trình (trích dẫn xác thực: ${c}).` : 'Đã duyệt công trình.', 'success')
      loadAll()
    } catch (e) { toast('Không duyệt được: ' + e.message, 'error') }
  }

  async function reject(p) {
    const note = await prompt({
      title: 'Từ chối công trình', message: p.title,
      label: 'Lý do từ chối (người nộp sẽ thấy)', placeholder: 'Ví dụ: Thiếu tóm tắt, sai thông tin tác giả...',
      confirmText: 'Từ chối', danger: true,
    })
    if (note === null) return
    const { error } = await supabase.from('publications').update({ status: 'REJECTED', admin_note: note || 'Chưa đạt yêu cầu' }).eq('id', p.id)
    if (error) { toast(error.message, 'error'); return }
    await log('REJECT', 'PUBLICATION', p.id, { status: 'PENDING' }, { status: 'REJECTED', note })
    toast('Đã từ chối công trình.', 'success')
    loadAll()
  }

  async function deletePub(p) {
    const ok = await confirm({
      title: 'Xóa công trình này?',
      message: `"${p.title}" sẽ bị xóa vĩnh viễn cùng danh sách tác giả, lượt yêu thích và báo cáo liên quan. Không thể hoàn tác.`,
      confirmText: 'Xóa vĩnh viễn', danger: true,
    })
    if (!ok) return
    const { error } = await supabase.from('publications').delete().eq('id', p.id)
    if (error) { toast('Không xóa được: ' + error.message, 'error'); return }
    // Xóa file đính kèm nếu nằm trong kho của hệ thống
    if (p.pdf_url && !/^https?:\/\//i.test(p.pdf_url)) {
      await supabase.storage.from('documents').remove([p.pdf_url])
    }
    await log('DELETE_PUBLICATION', 'PUBLICATION', p.id, { title: p.title, status: p.status }, null)
    toast('Đã xóa công trình.', 'success')
    loadAll()
  }

  async function changeRole(u, role) {
    const ok = await confirm({
      title: 'Đổi vai trò người dùng?', message: `${u.email}: ${u.role} → ${role}`, confirmText: 'Đổi vai trò',
    })
    if (!ok) { loadAll(); return }
    const { error } = await supabase.from('profiles').update({ role }).eq('id', u.id)
    if (error) { toast(error.message, 'error'); return }
    await log('CHANGE_ROLE', 'USER', u.id, { role: u.role }, { role })
    toast('Đã đổi vai trò.', 'success')
    loadAll()
  }

  async function deleteUser(u) {
    // Bước 1: gõ lại email để xác nhận
    const typed = await prompt({
      title: 'Xóa tài khoản người dùng?',
      message: `Tài khoản ${u.email} sẽ không thể đăng nhập nữa. Thao tác không thể hoàn tác.`,
      label: 'Gõ lại email của tài khoản để xác nhận', placeholder: u.email,
      confirmText: 'Tiếp tục', danger: true, required: true,
    })
    if (typed === null) return
    if (typed.trim().toLowerCase() !== u.email.toLowerCase()) {
      toast('Email xác nhận không khớp, chưa xóa gì.', 'error'); return
    }
    // Bước 2: giữ hay xóa công trình của họ (Esc hoặc bấm Giữ lại = giữ)
    const removeContent = await confirm({
      title: 'Xử lý hồ sơ và công trình của tài khoản này',
      message: 'Chọn "Xóa cả công trình" để xóa luôn hồ sơ nhà nghiên cứu và mọi công trình tài khoản này đã đăng. Chọn "Giữ lại" để chỉ xóa tài khoản (hồ sơ và bài vẫn còn, hiển thị là chưa có tài khoản).',
      confirmText: 'Xóa cả công trình', cancelText: 'Giữ lại', danger: true,
    })
    const { error } = await supabase.rpc('admin_delete_user', { uid: u.id, remove_content: removeContent })
    if (error) { toast('Không xóa được: ' + error.message, 'error'); return }
    toast('Đã xóa tài khoản.', 'success')
    loadAll()
  }

  const shownPubs = useMemo(() => {
    const k = clean(q.trim())
    return allPubs.filter(p =>
      (!st || p.status === st) &&
      (!k || clean(p.title + ' ' + (p.publication_authors || []).map(a => a.researchers?.full_name || '').join(' ')).includes(k)))
  }, [allPubs, q, st])

  const flagsByResearcher = useMemo(() => new Map(interest.map(x => [String(x.researcher_id), x])), [interest])
  const userRows = useMemo(() => users.filter(u => {
    const r = Array.isArray(u.researchers) ? u.researchers[0] : u.researchers
    const flags = flagsByResearcher.get(String(r?.id)) || {}
    const matchesType = interestFilter === 'all' ||
      (interestFilter === 'lecture' && flags.available_guest_lecturing) ||
      (interestFilter === 'consult' && flags.available_business_consulting) ||
      (interestFilter === 'both' && flags.available_guest_lecturing && flags.available_business_consulting)
    return matchesType && clean([u.email, r?.full_name].join(' ')).includes(clean(userSearch))
  }), [users, flagsByResearcher, interestFilter, userSearch])
  const quarterlyYears = useMemo(() => [...new Set(allPubs.map(p => new Date(p.created_at).getFullYear()).filter(Number.isFinite))].sort((x,y)=>y-x), [allPubs])
  const selectedYear = yearQuarter ? Number(yearQuarter) : (quarterlyYears[0] ?? new Date().getFullYear())
  const quarterly = useMemo(() => [1,2,3,4].map(q => {
    const matching = allPubs.filter(p => {
      const date = new Date(p.created_at)
      return !Number.isNaN(date.getTime()) && date.getFullYear() === selectedYear && Math.floor(date.getMonth()/3)+1 === q
    })
    return { q, count: matching.length, approved: matching.filter(p => p.status === 'APPROVED').length,
      pending: matching.filter(p => p.status === 'PENDING').length }
  }), [allPubs, selectedYear])
  const maxQuarter = Math.max(1, ...quarterly.map(q => q.count))
  const lectureCount = interest.filter(x => x.available_guest_lecturing).length
  const consultCount = interest.filter(x => x.available_business_consulting).length

  if (!isAdmin) return <main className="container page"><Loading text="Đang kiểm tra quyền..." /></main>

  const nameOf = u => (Array.isArray(u.researchers) ? u.researchers[0] : u.researchers)?.full_name || '—'
  const researcherOf = u => Array.isArray(u.researchers) ? u.researchers[0] : u.researchers

  const accountName = u => nameOf(u) === '—' ? (u.email || 'Tài khoản') : nameOf(u)
  const accountMap = new Map(users.map(u => [String(u.id), u]))
  const pubOwner = p => accountMap.get(String(p.created_by))
  const whoPosted = p => pubOwner(p) ? accountName(pubOwner(p)) : 'Không xác định / hồ sơ cũ'
  const authorNames = p => [...(p.publication_authors || [])].sort((a,b) => a.author_order - b.author_order)
    .map(a => a.researchers?.full_name).filter(Boolean).join(', ') || 'Chưa có dữ liệu tác giả'
  const formatDate = d => d ? new Date(d).toLocaleDateString('vi-VN') : '—'
  const stamp = d => d ? new Date(d).toLocaleString('vi-VN') : '—'
  const years = [...new Set(allPubs.map(p => new Date(p.created_at).getFullYear()).filter(Number.isFinite))].sort((a,b)=>b-a)
  const filteredPubs = allPubs.filter(p => {
    const date = new Date(p.created_at)
    if (Number.isNaN(date.getTime())) return false
    if (reportYear !== 'all' && date.getFullYear() !== Number(reportYear)) return false
    if (reportMonth !== 'all' && date.getMonth()+1 !== Number(reportMonth)) return false
    if (reportQuarter !== 'all' && Math.floor(date.getMonth()/3)+1 !== Number(reportQuarter)) return false
    if (reportPerson !== 'all' && String(p.created_by) !== reportPerson) return false
    if (reportStatus !== 'all' && p.status !== reportStatus) return false
    if (reportType !== 'all' && p.publication_type !== reportType) return false
    if (reportSearch && !clean([p.title,p.doi,whoPosted(p),authorNames(p)].join(' ')).includes(clean(reportSearch))) return false
    return true
  })
  const dateKey = (date, mode) => {
    if (mode === 'year') return String(date.getFullYear())
    if (mode === 'quarter') return `${date.getFullYear()}-Q${Math.floor(date.getMonth()/3)+1}`
    if (mode === 'day') return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`
    return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}`
  }
  const breakdown = Object.entries(filteredPubs.reduce((out,p) => {
    const label = dateKey(new Date(p.created_at), periodMode)
    if (!out[label]) out[label] = { label, total:0, approved:0, pending:0 }
    out[label].total++
    if (p.status === 'APPROVED') out[label].approved++
    if (p.status === 'PENDING') out[label].pending++
    return out
  }, {})).map(([,value])=>value).sort((a,b)=>a.label.localeCompare(b.label))
  const maxChart = Math.max(1,...breakdown.map(x=>x.total))
  const byPerson = Object.values(filteredPubs.reduce((out,p) => {
    const id = String(p.created_by || 'unknown')
    if (!out[id]) out[id] = { id, name:whoPosted(p), count:0, approved:0, pending:0, doi:0, last:null }
    const row = out[id]
    row.count++
    if(p.status==='APPROVED') row.approved++
    if(p.status==='PENDING') row.pending++
    if(p.doi) row.doi++
    if(!row.last || p.created_at>row.last) row.last=p.created_at
    return out
  },{})).sort((a,b)=>b.count-a.count)
  const rowsPerPage = 15
  const pageMax = Math.max(1,Math.ceil(filteredPubs.length/rowsPerPage))
  const safePage = Math.min(reportPage,pageMax)
  const visibleRows = filteredPubs.slice((safePage-1)*rowsPerPage,safePage*rowsPerPage)
  const exportCSV = () => {
    const fields = ['Ngày tải','Người đăng','Email người đăng','Tiêu đề','DOI','Loại','Năm công bố','Trạng thái','Tác giả']
    const quote = v => '"'+String(v ?? '').replace(/"/g,'""')+'"'
    const csv = '\uFEFF'+[fields,...filteredPubs.map(p=>[
      stamp(p.created_at),whoPosted(p),pubOwner(p)?.email||'',p.title,p.doi||'',typeNames[p.publication_type]||p.publication_type,p.publication_year||'',statusName[p.status]||p.status,authorNames(p)
    ])].map(row=>row.map(quote).join(',')).join('\r\n')
    const file = new Blob([csv],{type:'text/csv;charset=utf-8'})
    const url = URL.createObjectURL(file)
    const a=document.createElement('a');a.href=url;a.download=`UTEProfile_bao_cao_${new Date().toISOString().slice(0,10)}.csv`;a.click()
    URL.revokeObjectURL(url)
  }
  const nav = [
    {id:'overview',name:'Tổng quan',icon:LayoutDashboard},
    {id:'pubs',name:'Quản lý công trình',icon:BookOpen},
    {id:'pending',name:'Kiểm duyệt',icon:ShieldCheck,count:pending.length},
    {id:'users',name:'Quản lý tài khoản',icon:Users},
    {id:'reports',name:'Báo cáo & phân tích',icon:ChartNoAxesCombined},
    {id:'opportunities',name:'Thỉnh giảng & tư vấn',icon:BriefcaseBusiness},
    {id:'logs',name:'Nhật ký hoạt động',icon:ScrollText},
  ]
  const tabName = nav.find(x=>x.id===tab)?.name || 'Tổng quan'
  const openTab = id => {setTab(id);setReportPage(1)}
  const summaryCards = [
    {label:'Tài khoản',value:stats.users??'—',icon:Users,detail:'Đã có hồ sơ tài khoản'},
    {label:'Công trình công khai',value:stats.approved??'—',icon:BookOpen,detail:'Trạng thái đã duyệt'},
    {label:'Chờ kiểm duyệt',value:stats.pending??'—',icon:FileClock,detail:'Cần xử lý',action:'pending'},
    {label:'Công trình có DOI',value:allPubs.filter(p=>p.doi).length,icon:ShieldCheck,detail:'Trong dữ liệu đã tải'},
    {label:'Sẵn sàng thỉnh giảng',value:lectureCount,icon:UserRoundCheck,detail:'Đã tự đăng ký',action:'opportunities'},
    {label:'Tư vấn doanh nghiệp',value:consultCount,icon:BriefcaseBusiness,detail:'Đã tự đăng ký',action:'opportunities'},
  ]
  const reportControls = <div className="ap-filters">
    <label>Từ khóa <input value={reportSearch} onChange={e=>{setReportSearch(e.target.value);setReportPage(1)}} placeholder="Tên bài, DOI, người đăng..." /></label>
    <label>Năm tải lên <select value={reportYear} onChange={e=>{setReportYear(e.target.value);setReportPage(1)}}><option value="all">Mọi năm</option>{years.map(y=><option key={y} value={y}>{y}</option>)}</select></label>
    <label>Tháng <select value={reportMonth} onChange={e=>{setReportMonth(e.target.value);setReportPage(1)}}><option value="all">Cả năm</option>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>Tháng {i+1}</option>)}</select></label>
    <label>Quý <select value={reportQuarter} onChange={e=>{setReportQuarter(e.target.value);setReportPage(1)}}><option value="all">Mọi quý</option>{[1,2,3,4].map(q=><option key={q} value={q}>Quý {q}</option>)}</select></label>
    <label>Người đăng <select value={reportPerson} onChange={e=>{setReportPerson(e.target.value);setReportPage(1)}}><option value="all">Mọi tài khoản</option>{users.map(u=><option key={u.id} value={u.id}>{accountName(u)}</option>)}</select></label>
    <label>Trạng thái <select value={reportStatus} onChange={e=>{setReportStatus(e.target.value);setReportPage(1)}}><option value="all">Tất cả</option>{Object.entries(statusName).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
    <label>Loại công trình <select value={reportType} onChange={e=>{setReportType(e.target.value);setReportPage(1)}}><option value="all">Tất cả</option>{Object.entries(typeNames).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></label>
  </div>
  const detailedTable = <div className="ap-table-scroll"><table className="ap-table"><thead><tr>
    <th>Ngày đăng</th><th>Người đăng</th><th>Công trình</th><th>Loại / năm</th><th>Trạng thái</th><th>Chi tiết</th>
  </tr></thead><tbody>{visibleRows.map(p=><tr key={p.id}>
    <td className="ap-nowrap">{stamp(p.created_at)}</td>
    <td><strong>{whoPosted(p)}</strong><small>{pubOwner(p)?.email||'—'}</small></td>
    <td className="ap-title"><strong>{p.title}</strong><small>{p.doi ? 'DOI: '+p.doi : 'Nhập thủ công'} · {authorNames(p)}</small></td>
    <td>{typeNames[p.publication_type]||p.publication_type||'—'}<small>{p.publication_year||'—'}</small></td>
    <td><span className={'ap-status '+(p.status||'').toLowerCase()}>{statusName[p.status]||p.status}</span></td>
    <td><Link className="ap-link" to={p.status==='PENDING'?`/admin/review/${p.id}`:`/research/${p.id}`}>Xem <ExternalLink size={13}/></Link></td>
  </tr>)}{!visibleRows.length&&<tr><td colSpan="6" className="ap-empty">Không có công trình phù hợp bộ lọc.</td></tr>}</tbody></table>
  <div className="ap-pagination"><span>{filteredPubs.length} công trình · Trang {safePage}/{pageMax}</span><div><button disabled={safePage===1} onClick={()=>setReportPage(p=>Math.max(1,p-1))}>Trước</button><button disabled={safePage===pageMax} onClick={()=>setReportPage(p=>Math.min(pageMax,p+1))}>Sau</button></div></div></div>
  const reportDashboard = <>
    <section className="ap-panel"><div className="ap-panel-head"><div><h3>Phân tích theo thời gian</h3><p>Số công trình được tải lên hệ thống, không phải năm xuất bản</p></div><select aria-label="Độ chi tiết thời gian" value={periodMode} onChange={e=>setPeriodMode(e.target.value)}><option value="day">Theo ngày</option><option value="month">Theo tháng</option><option value="quarter">Theo quý</option><option value="year">Theo năm</option></select></div>
    <div className="ap-graph">{breakdown.length?breakdown.map(b=><div key={b.label} className="ap-graph-item" title={`${b.label}: ${b.total} công trình, ${b.approved} công khai, ${b.pending} chờ duyệt`}><strong>{b.total}</strong><div className="ap-bar-track"><div className="ap-bar" style={{height:`${Math.max(4,b.total/maxChart*100)}%`}} /></div><small>{b.label}</small></div>):<p className="ap-empty">Không có dữ liệu phù hợp.</p>}</div>
    <div className="ap-legend"><span>■ Tổng công trình: {filteredPubs.length}</span><span>● Công khai: {filteredPubs.filter(p=>p.status==='APPROVED').length}</span><span>● Chờ duyệt: {filteredPubs.filter(p=>p.status==='PENDING').length}</span></div></section>
    <section className="ap-panel"><div className="ap-panel-head"><div><h3>Ai đã đăng công trình?</h3><p>Nhấn tên tài khoản để lọc bảng chi tiết theo người đăng</p></div></div><div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>Người đăng</th><th>Tổng bài</th><th>Công khai</th><th>Chờ duyệt</th><th>Có DOI</th><th>Đăng gần nhất</th></tr></thead><tbody>{byPerson.map(x=><tr key={x.id}><td><button className="ap-name-link" onClick={()=>{setReportPerson(x.id);setReportPage(1)}}>{x.name}</button></td><td><b>{x.count}</b></td><td>{x.approved}</td><td>{x.pending}</td><td>{x.doi}</td><td>{stamp(x.last)}</td></tr>)}{!byPerson.length&&<tr><td colSpan="6" className="ap-empty">Chưa có dữ liệu người đăng.</td></tr>}</tbody></table></div></section>
    <section className="ap-panel"><div className="ap-panel-head"><div><h3>Danh sách bài đăng chi tiết</h3><p>Có tên người đăng, DOI, mốc thời gian và trạng thái</p></div><button className="ap-secondary" onClick={exportCSV}><Download size={16}/> Xuất CSV</button></div>{detailedTable}</section>
  </>
  return <main className="ap-shell">
    <aside className="ap-sidebar"><div className="ap-sidebar-brand"><div className="ap-brand-icon"><ShieldCheck size={22}/></div><div><strong>UTEProfile Admin</strong><small>Trung tâm quản trị</small></div></div><span className="ap-menu-label">KHÔNG GIAN LÀM VIỆC</span><nav aria-label="Điều hướng quản trị">{nav.map(item=>{const Icon=item.icon;return <button key={item.id} className={'ap-nav-btn '+(tab===item.id?'active':'')} onClick={()=>openTab(item.id)}><Icon size={18}/><span>{item.name}</span>{item.count>0&&<em>{item.count}</em>}</button>})}<Link className="ap-nav-btn" to="/admin/reports"><FileWarning size={18}/><span>Báo cáo vi phạm</span><ChevronRight size={15}/></Link></nav><div className="ap-sidebar-foot"><ShieldCheck size={17}/> Chế độ quản trị · {profile?.role||'ADMIN'}</div></aside>
    <div className="ap-content"><header className="ap-top"><div><span className="ap-eyebrow">QUẢN TRỊ HỆ THỐNG / {tabName.toUpperCase()}</span><h1>{tabName}</h1><p>Quản lý dữ liệu khoa học, tài khoản và hoạt động trên UTEProfile.</p></div><button className="ap-secondary" onClick={loadAll} disabled={busy}><RefreshCw size={16} className={busy?'ap-spin':''}/>{busy?'Đang tải':'Làm mới'}</button></header>
      {loadError&&<div className="ap-alert" role="alert">Một số dữ liệu không tải được: {loadError}</div>}
      {reportCount!==null && reportCount>allPubs.length && <div className="ap-alert">Đang hiển thị {allPubs.length}/{reportCount} công trình. Báo cáo chỉ bao gồm dữ liệu đã tải; muốn thống kê toàn bộ cần phân trang máy chủ hoặc RPC tổng hợp.</div>}
      {(tab==='overview')&&<><div className="ap-kpis">{summaryCards.map((item,i)=>{const Icon=item.icon;return <button className="ap-kpi" key={item.label} onClick={()=>openTab(item.action|| (i===0?'users':i===1||i===3?'pubs':'reports'))}><span className="ap-kpi-icon"><Icon size={19}/></span><span className="ap-kpi-value">{item.value}</span><strong>{item.label}</strong><small>{item.detail}</small></button>})}</div><div className="ap-section-title"><div><h2>Hoạt động công bố</h2><p>Thống kê theo dữ liệu đang quản lý</p></div><button className="ap-text-btn" onClick={()=>openTab('reports')}>Xem toàn bộ báo cáo <ChevronRight size={16}/></button></div>{reportDashboard}<section className="ap-panel"><div className="ap-panel-head"><div><h3>Thao tác nhanh</h3><p>Truy cập những việc cần xử lý thường xuyên</p></div></div><div className="ap-quick"><button onClick={()=>openTab('pending')}><FileClock/> Duyệt công trình ({pending.length})</button><button onClick={()=>openTab('users')}><Users/> Quản lý tài khoản</button><button onClick={()=>openTab('opportunities')}><BriefcaseBusiness/> Kết nối chuyên môn</button><Link to="/admin/reports"><FileWarning/> Xử lý báo cáo vi phạm</Link></div></section></>}
      {tab==='reports'&&<><section className="ap-panel"><div className="ap-panel-head"><div><h3>Bộ lọc báo cáo nâng cao</h3><p>Lọc đồng thời theo ngày, tháng, quý, năm, người đăng, loại và trạng thái</p></div><button className="ap-secondary" onClick={()=>{setReportYear('all');setReportMonth('all');setReportQuarter('all');setReportPerson('all');setReportStatus('all');setReportType('all');setReportSearch('');setReportPage(1)}}><Filter size={15}/> Xóa bộ lọc</button></div>{reportControls}</section>{reportDashboard}</>}
      {tab==='pending'&&<section className="ap-panel"><div className="ap-panel-head"><div><h3>Hàng chờ kiểm duyệt</h3><p>Bài DOI đã được xác minh và công khai tự động sẽ không nằm trong danh sách này</p></div><span className="ap-count">{pending.length} công trình</span></div><div className="ap-pending">{pending.map(p=><article className="ap-pending-item" key={p.id}><div><div className="ap-pending-meta"><span className="ap-status pending">Chờ duyệt</span> · {typeNames[p.publication_type]||'Công trình'} · {stamp(p.created_at)}</div><h3>{p.title}</h3><p>Người đăng: <b>{whoPosted(p)}</b> · Tác giả: {authorNames(p)}</p>{p.doi&&<small>DOI: {p.doi}</small>}</div><div className="ap-actions"><Link className="ap-secondary" to={`/admin/review/${p.id}`}>Xem bài</Link><button className="ap-positive" onClick={()=>approve(p)}><Check size={15}/> Duyệt</button><button className="ap-danger" onClick={()=>reject(p)}><X size={15}/> Từ chối</button></div></article>)}{!pending.length&&<div className="ap-empty">Không có công trình đang chờ duyệt.</div>}</div></section>}
      {tab==='pubs'&&<section className="ap-panel"><div className="ap-panel-head"><div><h3>Kho công trình hệ thống</h3><p>Tra cứu và kiểm tra công trình; thao tác xóa cần xác nhận</p></div></div><div className="ap-filters"><label>Tìm kiếm <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Tiêu đề / tác giả..." /></label><label>Trạng thái <select value={st} onChange={e=>setSt(e.target.value)}><option value="">Tất cả</option>{Object.entries(statusName).map(([k,v])=><option value={k} key={k}>{v}</option>)}</select></label></div><div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>Công trình</th><th>Người đăng</th><th>Ngày tải</th><th>Trạng thái</th><th>Thao tác</th></tr></thead><tbody>{shownPubs.map(p=><tr key={p.id}><td className="ap-title"><strong>{p.title}</strong><small>{p.doi||'Không có DOI'} · {authorNames(p)}</small></td><td>{whoPosted(p)}</td><td>{stamp(p.created_at)}</td><td><span className={'ap-status '+(p.status||'').toLowerCase()}>{statusName[p.status]||p.status}</span></td><td><div className="ap-inline-actions"><Link className="ap-link" to={p.status==='PENDING'?`/admin/review/${p.id}`:`/research/${p.id}`}>Xem</Link><button className="ap-link ap-delete" onClick={()=>deletePub(p)}><Trash2 size={14}/> Xóa</button></div></td></tr>)}{!shownPubs.length&&<tr><td colSpan="5" className="ap-empty">Không tìm thấy công trình.</td></tr>}</tbody></table></div></section>}
      {tab==='users'&&<section className="ap-panel"><div className="ap-panel-head"><div><h3>Danh sách tài khoản</h3><p>Xem hồ sơ, xuất CV, quản lý vai trò và tài khoản</p></div><span className="ap-count">{userRows.length} tài khoản</span></div><div className="ap-filters"><label>Tìm tên hoặc email<input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Tên / email..." /></label><label>Nhu cầu<select value={interestFilter} onChange={e=>setInterestFilter(e.target.value)}><option value="all">Tất cả</option><option value="lecture">Thỉnh giảng</option><option value="consult">Tư vấn DN</option><option value="both">Cả hai</option></select></label></div><div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>Người dùng</th><th>Ngày tạo</th><th>Vai trò</th><th>Thỉnh giảng / Tư vấn</th><th>CV</th><th>Quản lý</th></tr></thead><tbody>{userRows.map(u=>{const r=researcherOf(u);const f=flagsByResearcher.get(String(r?.id))||{};return <tr key={u.id}><td><strong>{accountName(u)}</strong><small>{u.email}</small></td><td>{formatDate(u.created_at)}</td><td><select aria-label={'Vai trò của '+accountName(u)} value={u.role} disabled={u.id===user.id} onChange={e=>changeRole(u,e.target.value)}><option>ADMIN</option><option>RESEARCHER</option><option>USER</option></select></td><td>{f.available_guest_lecturing?'Thỉnh giảng ':''}{f.available_business_consulting?'· Tư vấn DN':''}{!f.available_guest_lecturing&&!f.available_business_consulting?'—':''}</td><td>{r?.id?<div className="ap-inline-actions"><Link className="ap-link" to={`/researchers/${r.id}`}>Xem</Link><ExportCvButton researcherId={r.id} className="ap-secondary" /></div>:'Chưa có hồ sơ'}</td><td>{u.id===user.id||u.role==='ADMIN'?<span className="ap-muted">{u.id===user.id?'Tài khoản của bạn':'Đổi vai trò trước'}</span>:<button className="ap-link ap-delete" onClick={()=>deleteUser(u)}><Trash2 size={14}/> Xóa</button>}</td></tr>})}{!userRows.length&&<tr><td colSpan="6" className="ap-empty">Không có tài khoản phù hợp.</td></tr>}</tbody></table></div></section>}
      {tab==='opportunities'&&<section className="ap-panel"><div className="ap-panel-head"><div><h3>Kết nối thỉnh giảng & tư vấn doanh nghiệp</h3><p>Chỉ hiển thị người dùng chủ động đăng ký; thông tin chỉ dành cho Admin</p></div></div><div className="ap-kpis ap-kpis-small"><div className="ap-kpi"><strong>Thỉnh giảng</strong><span className="ap-kpi-value">{lectureCount}</span></div><div className="ap-kpi"><strong>Tư vấn DN</strong><span className="ap-kpi-value">{consultCount}</span></div><div className="ap-kpi"><strong>Đăng ký cả hai</strong><span className="ap-kpi-value">{interest.filter(f=>f.available_guest_lecturing&&f.available_business_consulting).length}</span></div></div><div className="ap-filters"><label>Tìm người đăng ký<input value={userSearch} onChange={e=>setUserSearch(e.target.value)} placeholder="Tên hoặc email" /></label><label>Lọc nhu cầu<select value={interestFilter} onChange={e=>setInterestFilter(e.target.value)}><option value="all">Tất cả</option><option value="lecture">Thỉnh giảng</option><option value="consult">Tư vấn doanh nghiệp</option><option value="both">Cả hai</option></select></label></div><div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>Nhà nghiên cứu</th><th>Đăng ký thỉnh giảng</th><th>Đăng ký tư vấn</th><th>Hồ sơ chuyên môn</th></tr></thead><tbody>{userRows.filter(u=>{const f=flagsByResearcher.get(String(researcherOf(u)?.id))||{};return f.available_guest_lecturing||f.available_business_consulting}).map(u=>{const r=researcherOf(u);const f=flagsByResearcher.get(String(r?.id))||{};return <tr key={u.id}><td><strong>{accountName(u)}</strong><small>{u.email}</small></td><td>{f.available_guest_lecturing?'Có':'—'}</td><td>{f.available_business_consulting?'Có':'—'}</td><td>{r?.id?<Link className="ap-link" to={`/researchers/${r.id}`}>Xem CV <ChevronRight size={14}/></Link>:'Chưa có CV'}</td></tr>})}{!userRows.some(u=>{const f=flagsByResearcher.get(String(researcherOf(u)?.id))||{};return f.available_guest_lecturing||f.available_business_consulting})&&<tr><td colSpan="4" className="ap-empty">Chưa có người đăng ký phù hợp.</td></tr>}</tbody></table></div></section>}
      {tab==='logs'&&<section className="ap-panel"><div className="ap-panel-head"><div><h3>Nhật ký hoạt động</h3><p>Chỉ các hành động đã được hệ thống ghi vào bảng audit_logs</p></div><span className="ap-count">{logs.length} bản ghi gần nhất</span></div><div className="ap-table-scroll"><table className="ap-table"><thead><tr><th>Thời gian</th><th>Tài khoản</th><th>Hành động</th><th>Đối tượng</th><th>Dữ liệu thay đổi</th></tr></thead><tbody>{logs.map(l=><tr key={l.id}><td>{stamp(l.created_at)}</td><td>{accountMap.get(String(l.user_id))?.email||l.user_id||'Hệ thống'}</td><td><strong>{l.action}</strong></td><td>{l.entity_type} #{l.entity_id}</td><td className="ap-log">{JSON.stringify(l.old_value)||'—'} → {JSON.stringify(l.new_value)||'—'}</td></tr>)}{!logs.length&&<tr><td colSpan="5" className="ap-empty">Chưa có nhật ký được ghi nhận.</td></tr>}</tbody></table></div></section>}
      <footer className="ap-foot"><span><Clock3 size={14}/> Dữ liệu cập nhật: {loadedAt?stamp(loadedAt):'đang tải'}</span><span>Chỉ dành cho quản trị viên · UTEProfile</span></footer>
    </div>
  </main>
}
