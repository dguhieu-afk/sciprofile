export default function Avatar({ name = '', url, size = 'md', className = '' }) {
  const letter = (name.trim().split(' ').pop()[0] || '?').toUpperCase()
  return url
    ? <img className={`av av-${size} ${className}`} src={url} alt={name} loading="lazy" />
    : <div className={`av av-${size} av-fallback ${className}`}>{letter}</div>
}