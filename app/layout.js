import "./globals.css";
import AuthProvider from "./components/AuthProvider";
import LogoutButton from "./components/LogoutButton";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Internship Hunt Dashboard",
  description: "AI-powered job matching and resume tailoring pipeline",
};

export default async function RootLayout({ children }) {
  const session = await auth();
  const isAuthPage = false; // Layout renders for all, middleware handles redirects

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {session ? (
            <div className="app-layout">
              <Sidebar user={session.user} />
              <main className="main-content">
                {children}
              </main>
            </div>
          ) : (
            <main className="main-content" style={{ marginLeft: 0 }}>
              {children}
            </main>
          )}
        </AuthProvider>
      </body>
    </html>
  );
}

function Sidebar({ user }) {
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
      <div className="sidebar-user">
        {user && (
          <>
            <div className="user-info">
              <div className="user-avatar">{user.name?.[0]?.toUpperCase() || '?'}</div>
              <div className="user-details">
                <div className="user-name">{user.name}</div>
                <div className="user-email">{user.email}</div>
              </div>
            </div>
            <LogoutButton />
          </>
        )}
        <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '8px' }}>
          Powered by n8n + Gemini
        </div>
      </div>
    </aside>
  );
}
