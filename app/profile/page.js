import { query } from '@/lib/db';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function ProfilePage() {
  let profile = null;
  let error = null;

  try {
    const rows = await query(
      "SELECT id, user_email, profile_name, profile_json, updated_at FROM profiles WHERE user_email = $1 AND profile_name = $2",
      ['jenilmahy25@gmail.com', 'general']
    );
    profile = rows[0] || null;
  } catch (e) {
    error = e.message;
  }

  if (error) {
    return (
      <div>
        <div className="page-header">
          <h2>Profile</h2>
          <p>Your candidate profile used for resume generation</p>
        </div>
        <div className="status-message error">⚠️ Database error: {error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div>
        <div className="page-header">
          <h2>Profile</h2>
          <p>Your candidate profile used for resume generation</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">👤</div>
          <h3>No profile found</h3>
          <p>Create a profile to start generating tailored resumes</p>
        </div>
      </div>
    );
  }

  const data = profile.profile_json;
  const info = data.profile || {};
  const contact = info.contact || {};
  const skills = info.skills || {};
  const education = info.education || [];
  const experience = data.experience || [];
  const projects = data.projects || [];
  const config = data.config || {};

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Profile</h2>
          <p>Your candidate profile used for resume generation</p>
        </div>
        <Link href="/profile/edit" className="btn btn-primary">
          ✏️ Edit Profile
        </Link>
      </div>

      {/* Identity Card */}
      <div className="card card-glow" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: '24px', fontWeight: 700, marginBottom: '4px' }}>{info.name}</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{contact.email}</p>
          </div>
          <div style={{ textAlign: 'right', fontSize: '13px', color: 'var(--text-muted)' }}>
            <div>{contact.location}</div>
            <div>{contact.phone}</div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'flex-end' }}>
              {contact.linkedin && (
                <a href={contact.linkedin} target="_blank" rel="noopener noreferrer" className="job-link" style={{ fontSize: '13px' }}>
                  LinkedIn ↗
                </a>
              )}
              {contact.github && (
                <a href={contact.github} target="_blank" rel="noopener noreferrer" className="job-link" style={{ fontSize: '13px' }}>
                  GitHub ↗
                </a>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="grid-2col">
        {/* Left Column */}
        <div>
          {/* Education */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🎓 Education</h3>
            {education.map((edu, i) => (
              <div key={i} style={{ marginBottom: i < education.length - 1 ? '16px' : 0, paddingBottom: i < education.length - 1 ? '16px' : 0, borderBottom: i < education.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{edu.institution}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{edu.degree}</div>
                    {edu.relevant_coursework && (
                      <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '6px' }}>
                        {edu.relevant_coursework.join(' • ')}
                      </div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <span className="badge badge-info">{edu.gpa}</span>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>{edu.grad_date}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Experience */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>💼 Experience ({experience.length} entries)</h3>
            {experience.map((exp, i) => (
              <div key={exp.id || i} style={{ marginBottom: i < experience.length - 1 ? '20px' : 0, paddingBottom: i < experience.length - 1 ? '20px' : 0, borderBottom: i < experience.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{exp.role}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
                      {exp.company} — <em>{exp.project_name}</em>
                    </div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', flexShrink: 0 }}>{exp.dates}</div>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--accent-secondary)', marginBottom: '8px' }}>
                  {exp.summary_sentence}
                </p>
                {exp.tech_stack && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {exp.tech_stack.map((t, j) => (
                      <span key={j} style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', borderRadius: '100px', fontWeight: 500 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(exp.bullet_points_pool || []).map((bp, j) => (
                    <li key={j} style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '14px', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--text-muted)' }}>•</span>
                      {bp}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* Projects */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🚀 Projects ({projects.length} entries)</h3>
            {projects.map((proj, i) => (
              <div key={proj.id || i} style={{ marginBottom: i < projects.length - 1 ? '20px' : 0, paddingBottom: i < projects.length - 1 ? '20px' : 0, borderBottom: i < projects.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '15px' }}>{proj.project_name}</div>
                    <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{proj.role}</div>
                  </div>
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>{proj.dates}</div>
                </div>
                <p style={{ fontSize: '13px', color: 'var(--accent-secondary)', marginBottom: '8px' }}>
                  {proj.summary_sentence}
                </p>
                {proj.tech_stack && (
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
                    {proj.tech_stack.map((t, j) => (
                      <span key={j} style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--accent-primary-glow)', color: 'var(--accent-primary)', borderRadius: '100px', fontWeight: 500 }}>
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                <ul style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {(proj.bullet_points_pool || []).map((bp, j) => (
                    <li key={j} style={{ fontSize: '13px', color: 'var(--text-secondary)', paddingLeft: '14px', position: 'relative' }}>
                      <span style={{ position: 'absolute', left: 0, color: 'var(--text-muted)' }}>•</span>
                      {bp}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column */}
        <div>
          {/* Skills */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>🛠️ Skills</h3>
            {Object.entries(skills).map(([category, items]) => (
              <div key={category} style={{ marginBottom: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>
                  {category.replace(/_/g, ' ')}
                </div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {(Array.isArray(items) ? items : []).map((skill, j) => (
                    <span key={j} style={{ fontSize: '12px', padding: '4px 10px', background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: '100px', color: 'var(--text-secondary)' }}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Config */}
          <div className="card" style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>⚙️ Config</h3>
            <div className="detail-field">
              <div className="field-label">Minimum Score Threshold</div>
              <div className="field-value">
                <span className="score-pill score-mid">{config.min_score || 70}</span>
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Jobs below this score are rejected
              </div>
            </div>
          </div>

          {/* Metadata */}
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '16px' }}>📋 Metadata</h3>
            <div className="detail-field">
              <div className="field-label">Profile Name</div>
              <div className="field-value">{profile.profile_name}</div>
            </div>
            <div className="detail-field">
              <div className="field-label">Email</div>
              <div className="field-value">{profile.user_email}</div>
            </div>
            <div className="detail-field">
              <div className="field-label">Last Updated</div>
              <div className="field-value">
                {profile.updated_at ? new Date(profile.updated_at).toLocaleString() : '—'}
              </div>
            </div>
            <div className="detail-field">
              <div className="field-label">JSON Size</div>
              <div className="field-value">{(JSON.stringify(data).length / 1024).toFixed(1)} KB</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
