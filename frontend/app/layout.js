/* eslint-disable @next/next/no-page-custom-font */
import "./globals.css";
import AuthProvider from "./components/AuthProvider";
import LogoutButton from "./components/LogoutButton";
import MobileNav from "./components/MobileNav";
import { auth } from "@/lib/auth";
import Link from "next/link";

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
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <AuthProvider>
          {session ? (
            <MobileNav>
              <div className="app-layout">
                <Sidebar user={session.user} />
                <main className="main-content">
                  {children}
                </main>
              </div>
            </MobileNav>
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
        <Link href="/">
          <span className="nav-icon">📊</span>
          <span>Dashboard</span>
        </Link>
        <Link href="/jobs">
          <span className="nav-icon">💼</span>
          <span>Jobs</span>
        </Link>
        <Link href="/upload">
          <span className="nav-icon">📤</span>
          <span>Upload JD</span>
        </Link>
        <Link href="/resumes">
          <span className="nav-icon">📄</span>
          <span>Resumes</span>
        </Link>
        <Link href="/profile">
          <span className="nav-icon">👤</span>
          <span>Profile</span>
        </Link>
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
