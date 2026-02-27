import "./globals.css";

export const metadata = {
  title: "Internship Hunt Dashboard",
  description: "AI-powered job matching and resume tailoring pipeline",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="app-layout">
          <Sidebar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

function Sidebar() {
  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="logo-icon">🎯</div>
        <h1>Internship Hunt</h1>
      </div>
      <nav className="sidebar-nav">
        <a href="/">
          <span className="nav-icon">📊</span>
          <span>Dashboard</span>
        </a>
        <a href="/jobs">
          <span className="nav-icon">💼</span>
          <span>Jobs</span>
        </a>
        <a href="/upload">
          <span className="nav-icon">📤</span>
          <span>Upload JD</span>
        </a>
        <a href="/resumes">
          <span className="nav-icon">📄</span>
          <span>Resumes</span>
        </a>
        <a href="/profile">
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </a>
      </nav>
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: '16px', marginTop: 'auto' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Powered by n8n + Gemini
        </div>
      </div>
    </aside>
  );
}
