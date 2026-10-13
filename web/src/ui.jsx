import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { CheckCircle2, AlertCircle, Info } from 'lucide-react'

const Ctx = createContext(null)
export const useUI = () => useContext(Ctx)

function Dialog({ dlg, close }) {
  const [val, setVal] = useState(dlg.defaultValue || '')
  const isPrompt = dlg.kind === 'prompt'
  const cancel = () => close(isPrompt ? null : false)
  const ok = () => close(isPrompt ? val.trim() : true)
  const blocked = isPrompt && dlg.required && !val.trim()

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') cancel() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }) // eslint-disable-line

  return (
    <div className="modal-bg" onMouseDown={cancel}>
      <div className="modal" role="dialog" aria-modal="true" onMouseDown={e => e.stopPropagation()}>
        <h3>{dlg.title}</h3>
        {dlg.message && <p className="modal-msg">{dlg.message}</p>}
        {isPrompt && (
          <label className="modal-label">{dlg.label}
            <textarea autoFocus rows={3} value={val} placeholder={dlg.placeholder} onChange={e => setVal(e.target.value)} />
          </label>
        )}
        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={cancel}>{dlg.cancelText || 'Hủy'}</button>
          <button type="button" className={`btn ${dlg.danger ? 'btn-danger' : 'btn-primary'}`}
            disabled={blocked} onClick={ok} autoFocus={!isPrompt}>
            {dlg.confirmText || 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function UIProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const [dlg, setDlg] = useState(null)
  const seq = useRef(0)

  const toast = useCallback((message, type = 'info') => {
    const id = ++seq.current
    setToasts(t => [...t, { id, message, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4200)
  }, [])

  const ask = useCallback((kind, opts) =>
    new Promise(res => setDlg({ kind, id: ++seq.current, res, ...opts })), [])
  const confirm = useCallback(o => ask('confirm', o), [ask])
  const prompt = useCallback(o => ask('prompt', o), [ask])

  const close = r => { dlg.res(r); setDlg(null) }
  const value = useMemo(() => ({ toast, confirm, prompt }), [toast, confirm, prompt])
  const Icon = { success: CheckCircle2, error: AlertCircle, info: Info }

  return (
    <Ctx.Provider value={value}>
      {children}
      {dlg && <Dialog key={dlg.id} dlg={dlg} close={close} />}
      <div className="toasts" aria-live="polite">
        {toasts.map(t => {
          const I = Icon[t.type] || Info
          return <div key={t.id} className={`toast toast-${t.type}`}><I size={18} /> <span>{t.message}</span></div>
        })}
      </div>
    </Ctx.Provider>
  )
}