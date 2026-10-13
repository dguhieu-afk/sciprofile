import { Component } from 'react'

export default class ErrorBoundary extends Component {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  componentDidCatch(err) { console.error(err) }
  render() {
    if (!this.state.failed) return this.props.children
    return (
      <main className="container page" style={{ textAlign: 'center', paddingTop: 90 }}>
        <h1>Đã có lỗi xảy ra</h1>
        <p className="muted" style={{ margin: '10px 0 22px' }}>Rất tiếc, trang gặp sự cố. Bạn thử tải lại hoặc quay về trang chủ.</p>
        <button className="btn btn-primary" onClick={() => { window.location.href = '/' }}>Về trang chủ</button>
      </main>
    )
  }
}