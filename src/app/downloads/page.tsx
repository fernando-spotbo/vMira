export default function DownloadsPage() {
  return (
    <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: '600px' }}>
      <h1>downloads.vmira.ai</h1>
      <p>Plugin distribution CDN for Mira Code.</p>
      <h2>Endpoints</h2>
      <ul>
        <li><code>/mira-code-releases/plugins/mira-plugins-official/latest</code></li>
        <li><code>/mira-code-releases/plugins/mira-plugins-official/&#123;sha&#125;.zip</code></li>
      </ul>
    </main>
  )
}
