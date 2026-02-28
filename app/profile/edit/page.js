'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function ProfileEditPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null);
  const [profile, setProfile] = useState(null);
  const [activeTab, setActiveTab] = useState('info');
  const [uploadingTemplate, setUploadingTemplate] = useState(false);

  useEffect(() => {
    fetch('/api/profile')
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setLoading(false);
      })
      .catch(() => {
        setStatus({ type: 'error', message: 'Failed to load profile' });
        setLoading(false);
      });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      if (res.ok) {
        setStatus({ type: 'success', message: 'Profile saved successfully!' });
      } else {
        const err = await res.json();
        setStatus({ type: 'error', message: err.error || 'Save failed' });
      }
    } catch (e) {
      setStatus({ type: 'error', message: e.message });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div>
        <div className="page-header"><h2>Edit Profile</h2></div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '40px', justifyContent: 'center' }}>
          <div className="spinner" /> Loading profile...
        </div>
      </div>
    );
  }

  if (!profile) return null;

  const data = profile.profile_json;
  const info = data.profile || {};
  const contact = info.contact || {};
  const skills = info.skills || {};
  const education = info.education || [];
  const experience = data.experience || [];
  const projects = data.projects || [];
  const config = data.config || {};

  // Helpers to safely update nested state
  const updateInfo = (key, value) => {
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        profile: { ...prev.profile_json.profile, [key]: value }
      }
    }));
  };

  const updateContact = (key, value) => {
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        profile: {
          ...prev.profile_json.profile,
          contact: { ...prev.profile_json.profile.contact, [key]: value }
        }
      }
    }));
  };

  const updateSkillCategory = (category, value) => {
    const arr = value.split(',').map(s => s.trim()).filter(Boolean);
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        profile: {
          ...prev.profile_json.profile,
          skills: { ...prev.profile_json.profile.skills, [category]: arr }
        }
      }
    }));
  };

  const addSkillCategory = () => {
    const name = prompt('Enter new skill category name (e.g. databases, cloud, testing):');
    if (!name || !name.trim()) return;
    const key = name.trim().toLowerCase().replace(/\s+/g, '_');
    if (skills[key]) {
      setStatus({ type: 'error', message: `Skill category "${key}" already exists` });
      return;
    }
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        profile: {
          ...prev.profile_json.profile,
          skills: { ...prev.profile_json.profile.skills, [key]: [] }
        }
      }
    }));
  };

  const removeSkillCategory = (category) => {
    if (!confirm(`Remove the "${category.replace(/_/g, ' ')}" skill section?`)) return;
    setProfile(prev => {
      const newSkills = { ...prev.profile_json.profile.skills };
      delete newSkills[category];
      return {
        ...prev,
        profile_json: {
          ...prev.profile_json,
          profile: { ...prev.profile_json.profile, skills: newSkills }
        }
      };
    });
  };

  const renameSkillCategory = (oldKey) => {
    const newName = prompt('Rename this category to:', oldKey.replace(/_/g, ' '));
    if (!newName || !newName.trim()) return;
    const newKey = newName.trim().toLowerCase().replace(/\s+/g, '_');
    if (newKey === oldKey) return;
    if (skills[newKey]) {
      setStatus({ type: 'error', message: `Skill category "${newKey}" already exists` });
      return;
    }
    setProfile(prev => {
      const oldSkills = prev.profile_json.profile.skills;
      const newSkills = {};
      for (const [k, v] of Object.entries(oldSkills)) {
        newSkills[k === oldKey ? newKey : k] = v;
      }
      return {
        ...prev,
        profile_json: {
          ...prev.profile_json,
          profile: { ...prev.profile_json.profile, skills: newSkills }
        }
      };
    });
  };

  const updateExperience = (index, field, value) => {
    setProfile(prev => {
      const newExp = [...prev.profile_json.experience];
      newExp[index] = { ...newExp[index], [field]: value };
      return { ...prev, profile_json: { ...prev.profile_json, experience: newExp } };
    });
  };

  const updateExpBullet = (expIndex, bulletIndex, value) => {
    setProfile(prev => {
      const newExp = [...prev.profile_json.experience];
      const bullets = [...(newExp[expIndex].bullet_points_pool || [])];
      bullets[bulletIndex] = value;
      newExp[expIndex] = { ...newExp[expIndex], bullet_points_pool: bullets };
      return { ...prev, profile_json: { ...prev.profile_json, experience: newExp } };
    });
  };

  const addExpBullet = (expIndex) => {
    setProfile(prev => {
      const newExp = [...prev.profile_json.experience];
      const bullets = [...(newExp[expIndex].bullet_points_pool || []), ''];
      newExp[expIndex] = { ...newExp[expIndex], bullet_points_pool: bullets };
      return { ...prev, profile_json: { ...prev.profile_json, experience: newExp } };
    });
  };

  const removeExpBullet = (expIndex, bulletIndex) => {
    setProfile(prev => {
      const newExp = [...prev.profile_json.experience];
      const bullets = [...(newExp[expIndex].bullet_points_pool || [])];
      bullets.splice(bulletIndex, 1);
      newExp[expIndex] = { ...newExp[expIndex], bullet_points_pool: bullets };
      return { ...prev, profile_json: { ...prev.profile_json, experience: newExp } };
    });
  };

  const updateProject = (index, field, value) => {
    setProfile(prev => {
      const newProj = [...prev.profile_json.projects];
      newProj[index] = { ...newProj[index], [field]: value };
      return { ...prev, profile_json: { ...prev.profile_json, projects: newProj } };
    });
  };

  const updateProjBullet = (projIndex, bulletIndex, value) => {
    setProfile(prev => {
      const newProj = [...prev.profile_json.projects];
      const bullets = [...(newProj[projIndex].bullet_points_pool || [])];
      bullets[bulletIndex] = value;
      newProj[projIndex] = { ...newProj[projIndex], bullet_points_pool: bullets };
      return { ...prev, profile_json: { ...prev.profile_json, projects: newProj } };
    });
  };

  const addProjBullet = (projIndex) => {
    setProfile(prev => {
      const newProj = [...prev.profile_json.projects];
      const bullets = [...(newProj[projIndex].bullet_points_pool || []), ''];
      newProj[projIndex] = { ...newProj[projIndex], bullet_points_pool: bullets };
      return { ...prev, profile_json: { ...prev.profile_json, projects: newProj } };
    });
  };

  const removeProjBullet = (projIndex, bulletIndex) => {
    setProfile(prev => {
      const newProj = [...prev.profile_json.projects];
      const bullets = [...(newProj[projIndex].bullet_points_pool || [])];
      bullets.splice(bulletIndex, 1);
      newProj[projIndex] = { ...newProj[projIndex], bullet_points_pool: bullets };
      return { ...prev, profile_json: { ...prev.profile_json, projects: newProj } };
    });
  };

  const updateConfig = (key, value) => {
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        config: { ...prev.profile_json.config, [key]: value }
      }
    }));
  };

  const addEducation = () => {
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        profile: {
          ...prev.profile_json.profile,
          education: [...(prev.profile_json.profile.education || []), {
            institution: '', degree: '', gpa: '', grad_date: ''
          }]
        }
      }
    }));
  };

  const removeEducation = (index) => {
    setProfile(prev => {
      const newEdu = [...(prev.profile_json.profile.education || [])];
      newEdu.splice(index, 1);
      return { 
        ...prev, 
        profile_json: { 
          ...prev.profile_json, 
          profile: {
            ...prev.profile_json.profile,
            education: newEdu
          }
        } 
      };
    });
  };

  const handleTemplateUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.tex')) {
      setStatus({ type: 'error', message: 'Only .tex files are allowed' });
      return;
    }

    setUploadingTemplate(true);
    setStatus(null);
    
    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await fetch('/api/template/upload', {
        method: 'POST',
        body: formData,
      });
      
      if (res.ok) {
        setStatus({ type: 'success', message: 'Template uploaded successfully!' });
      } else {
        const err = await res.json();
        setStatus({ type: 'error', message: err.error || 'Upload failed' });
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    }
    
    setUploadingTemplate(false);
    e.target.value = ''; // Reset input
  };

  const addExperience = () => {
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        experience: [...prev.profile_json.experience, {
          id: `exp_new_${Date.now()}`, role: '', company: '', project_name: '', dates: '',
          summary_sentence: '', tech_stack: [], bullet_points_pool: [''], category: [], metrics: {}
        }]
      }
    }));
  };

  const removeExperience = (index) => {
    setProfile(prev => {
      const newExp = [...prev.profile_json.experience];
      newExp.splice(index, 1);
      return { ...prev, profile_json: { ...prev.profile_json, experience: newExp } };
    });
  };

  const addProject = () => {
    setProfile(prev => ({
      ...prev,
      profile_json: {
        ...prev.profile_json,
        projects: [...prev.profile_json.projects, {
          id: `proj_new_${Date.now()}`, project_name: '', role: '', dates: '',
          summary_sentence: '', tech_stack: [], bullet_points_pool: [''], category: [], metrics: {}
        }]
      }
    }));
  };

  const removeProject = (index) => {
    setProfile(prev => {
      const newProj = [...prev.profile_json.projects];
      newProj.splice(index, 1);
      return { ...prev, profile_json: { ...prev.profile_json, projects: newProj } };
    });
  };

  const tabs = [
    { key: 'info', label: '👤 Info', icon: '👤' },
    { key: 'experience', label: '💼 Experience', icon: '💼' },
    { key: 'projects', label: '🚀 Projects', icon: '🚀' },
    { key: 'skills', label: '🛠️ Skills', icon: '🛠️' },
    { key: 'config', label: '⚙️ Config', icon: '⚙️' },
    { key: 'template', label: '📄 Template', icon: '📄' },
  ];

  return (
    <div>
      <Link href="/profile" className="back-link">← Back to Profile</Link>

      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2>Edit Profile</h2>
          <p>Update your candidate information for resume generation</p>
        </div>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? <><div className="spinner" /> Saving...</> : '💾 Save Changes'}
        </button>
      </div>

      {status && (
        <div className={`status-message ${status.type}`}>
          {status.type === 'success' ? '✅' : '⚠️'} {status.message}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', flexWrap: 'wrap' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`btn btn-sm ${activeTab === tab.key ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setActiveTab(tab.key)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Info Tab */}
      {activeTab === 'info' && (
        <div className="grid-2col">
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Personal Info</h3>
            <div className="form-group">
              <label>Full Name</label>
              <input className="form-input" value={info.name || ''} onChange={e => updateInfo('name', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email</label>
              <input className="form-input" value={contact.email || ''} onChange={e => updateContact('email', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Phone</label>
              <input className="form-input" value={contact.phone || ''} onChange={e => updateContact('phone', e.target.value)} />
            </div>
            <div className="form-group">
              <label>Location</label>
              <input className="form-input" value={contact.location || ''} onChange={e => updateContact('location', e.target.value)} />
            </div>
          </div>
          <div className="card">
            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Links</h3>
            <div className="form-group">
              <label>LinkedIn URL</label>
              <input className="form-input" value={contact.linkedin || ''} onChange={e => updateContact('linkedin', e.target.value)} />
            </div>
            <div className="form-group">
              <label>GitHub URL</label>
              <input className="form-input" value={contact.github || ''} onChange={e => updateContact('github', e.target.value)} />
            </div>

            <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px', marginTop: '24px' }}>Education</h3>
            {education.map((edu, i) => (
              <div key={i} style={{ padding: '16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)', marginBottom: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeEducation(i)} style={{ color: 'var(--error)' }}>✕ Remove</button>
                </div>
                <div className="form-group">
                  <label>Institution</label>
                  <input className="form-input" value={edu.institution || ''} onChange={e => {
                    const newEdu = [...education];
                    newEdu[i] = { ...newEdu[i], institution: e.target.value };
                    updateInfo('education', newEdu);
                  }} />
                </div>
                <div className="form-group">
                  <label>Degree</label>
                  <input className="form-input" value={edu.degree || ''} onChange={e => {
                    const newEdu = [...education];
                    newEdu[i] = { ...newEdu[i], degree: e.target.value };
                    updateInfo('education', newEdu);
                  }} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>GPA</label>
                    <input className="form-input" value={edu.gpa || ''} onChange={e => {
                      const newEdu = [...education];
                      newEdu[i] = { ...newEdu[i], gpa: e.target.value };
                      updateInfo('education', newEdu);
                    }} />
                  </div>
                  <div className="form-group" style={{ flex: 1 }}>
                    <label>Graduation</label>
                    <input className="form-input" value={edu.grad_date || ''} onChange={e => {
                      const newEdu = [...education];
                      newEdu[i] = { ...newEdu[i], grad_date: e.target.value };
                      updateInfo('education', newEdu);
                    }} />
                  </div>
                </div>
              </div>
            ))}
            <button className="btn btn-secondary btn-sm" onClick={addEducation} style={{ marginTop: '12px' }}>+ Add Education</button>
          </div>
        </div>
      )}

      {/* Experience Tab */}
      {activeTab === 'experience' && (
        <div>
          {experience.map((exp, i) => (
            <div key={exp.id ||i} className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                  {exp.project_name || exp.role || `Experience ${i + 1}`}
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => removeExperience(i)} style={{ color: 'var(--error)' }}>
                  🗑️ Remove
                </button>
              </div>
              <div className="grid-2col">
                <div className="form-group">
                  <label>Role / Title</label>
                  <input className="form-input" value={exp.role || ''} onChange={e => updateExperience(i, 'role', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Company</label>
                  <input className="form-input" value={exp.company || ''} onChange={e => updateExperience(i, 'company', e.target.value)} />
                </div>
              </div>
              <div className="grid-2col">
                <div className="form-group">
                  <label>Project Name</label>
                  <input className="form-input" value={exp.project_name || ''} onChange={e => updateExperience(i, 'project_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Dates</label>
                  <input className="form-input" value={exp.dates || ''} onChange={e => updateExperience(i, 'dates', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Summary</label>
                <input className="form-input" value={exp.summary_sentence || ''} onChange={e => updateExperience(i, 'summary_sentence', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tech Stack (comma separated)</label>
                <input className="form-input" value={(exp.tech_stack || []).join(', ')} onChange={e => updateExperience(i, 'tech_stack', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
              </div>
              <div className="form-group">
                <label>Bullet Points</label>
                {(exp.bullet_points_pool || []).map((bp, j) => (
                  <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input className="form-input" value={bp} onChange={e => updateExpBullet(i, j, e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => removeExpBullet(i, j)} style={{ color: 'var(--error)', flexShrink: 0 }}>✕</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => addExpBullet(i)}>+ Add Bullet</button>
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={addExperience} style={{ width: '100%', justifyContent: 'center' }}>
            + Add Experience
          </button>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div>
          {projects.map((proj, i) => (
            <div key={proj.id || i} className="card" style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>
                  {proj.project_name || `Project ${i + 1}`}
                </h3>
                <button className="btn btn-ghost btn-sm" onClick={() => removeProject(i)} style={{ color: 'var(--error)' }}>
                  🗑️ Remove
                </button>
              </div>
              <div className="grid-2col">
                <div className="form-group">
                  <label>Project Name</label>
                  <input className="form-input" value={proj.project_name || ''} onChange={e => updateProject(i, 'project_name', e.target.value)} />
                </div>
                <div className="form-group">
                  <label>Role</label>
                  <input className="form-input" value={proj.role || ''} onChange={e => updateProject(i, 'role', e.target.value)} />
                </div>
              </div>
              <div className="form-group">
                <label>Dates / Duration</label>
                <input className="form-input" value={proj.dates || ''} onChange={e => updateProject(i, 'dates', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Summary</label>
                <input className="form-input" value={proj.summary_sentence || ''} onChange={e => updateProject(i, 'summary_sentence', e.target.value)} />
              </div>
              <div className="form-group">
                <label>Tech Stack (comma separated)</label>
                <input className="form-input" value={(proj.tech_stack || []).join(', ')} onChange={e => updateProject(i, 'tech_stack', e.target.value.split(',').map(s => s.trim()).filter(Boolean))} />
              </div>
              <div className="form-group">
                <label>Bullet Points</label>
                {(proj.bullet_points_pool || []).map((bp, j) => (
                  <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input className="form-input" value={bp} onChange={e => updateProjBullet(i, j, e.target.value)} style={{ flex: 1 }} />
                    <button className="btn btn-ghost btn-sm" onClick={() => removeProjBullet(i, j)} style={{ color: 'var(--error)', flexShrink: 0 }}>✕</button>
                  </div>
                ))}
                <button className="btn btn-secondary btn-sm" onClick={() => addProjBullet(i)}>+ Add Bullet</button>
              </div>
            </div>
          ))}
          <button className="btn btn-primary" onClick={addProject} style={{ width: '100%', justifyContent: 'center' }}>
            + Add Project
          </button>
        </div>
      )}

      {/* Skills Tab */}
      {activeTab === 'skills' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Skills (comma separated)</h3>
          {Object.entries(skills).map(([category, items]) => (
            <div className="form-group" key={category}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                <label style={{ margin: 0, flex: 1 }}>{category.replace(/_/g, ' ')}</label>
                <button className="btn btn-ghost btn-sm" onClick={() => renameSkillCategory(category)} style={{ fontSize: '12px', padding: '2px 8px' }} title="Rename">✏️</button>
                <button className="btn btn-ghost btn-sm" onClick={() => removeSkillCategory(category)} style={{ fontSize: '12px', padding: '2px 8px', color: 'var(--error)' }} title="Remove">✕</button>
              </div>
              <input
                className="form-input"
                value={(Array.isArray(items) ? items : []).join(', ')}
                onChange={e => updateSkillCategory(category, e.target.value)}
                placeholder="e.g. Python, JavaScript, Go"
              />
            </div>
          ))}
          <button className="btn btn-secondary btn-sm" onClick={addSkillCategory} style={{ marginTop: '12px' }}>+ Add Skill Section</button>
          <div style={{ marginTop: '16px', padding: '12px', background: 'var(--info-bg)', borderRadius: 'var(--radius-md)', fontSize: '13px', color: 'var(--info)' }}>
            💡 These skills are what Gemini uses to match against job descriptions. Keep them up to date!
          </div>
        </div>
      )}

      {/* Config Tab */}
      {activeTab === 'config' && (
        <div className="card" style={{ maxWidth: '500px' }}>
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Pipeline Configuration</h3>
          <div className="form-group">
            <label>Minimum Match Score</label>
            <input
              className="form-input"
              type="number"
              min="0"
              max="100"
              value={config.min_score || 70}
              onChange={e => updateConfig('min_score', parseInt(e.target.value) || 0)}
            />
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Jobs scoring below this will be rejected and not generate a resume (current: {config.min_score || 70})
            </div>
          </div>

          <div className="form-group" style={{ marginTop: '24px' }}>
            <label>Generate Cover Letter</label>
            <div
              onClick={() => updateConfig('generate_cover_letter', !config.generate_cover_letter)}
              style={{
                display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer',
                padding: '12px 16px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)',
                border: `1px solid ${config.generate_cover_letter ? 'var(--success)' : 'var(--border)'}`,
                transition: 'all 0.2s ease'
              }}
            >
              <div style={{
                width: '44px', height: '24px', borderRadius: '12px',
                background: config.generate_cover_letter ? 'var(--success)' : 'var(--text-disabled)',
                transition: 'all 0.2s ease', position: 'relative', flexShrink: 0
              }}>
                <div style={{
                  width: '18px', height: '18px', borderRadius: '50%', background: 'white',
                  position: 'absolute', top: '3px',
                  left: config.generate_cover_letter ? '23px' : '3px',
                  transition: 'left 0.2s ease',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                }} />
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: config.generate_cover_letter ? 'var(--success)' : 'var(--text-secondary)' }}>
                  {config.generate_cover_letter ? '✉️ Enabled' : 'Disabled'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                  When enabled, AI generates a tailored cover letter for each qualifying job
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Template Tab */}
      {activeTab === 'template' && (
        <div className="card">
          <h3 style={{ fontSize: '16px', fontWeight: 600, marginBottom: '20px' }}>Custom Resume Template</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '14px' }}>
            Upload a master <code>.tex</code> template. Our AI injects your profile data into this template using specific markers. 
            <strong>You must use the same markers as the default template!</strong>
          </p>
          
          <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start' }}>
            <div style={{ flex: 1, padding: '24px', border: '2px dashed var(--border-accent)', borderRadius: 'var(--radius-md)', textAlign: 'center' }}>
               <input 
                 type="file" 
                 accept=".tex" 
                 id="template-upload" 
                 style={{ display: 'none' }} 
                 onChange={handleTemplateUpload} 
               />
               <label htmlFor="template-upload" className="btn btn-primary" style={{ cursor: 'pointer', display: 'inline-flex' }}>
                 {uploadingTemplate ? 'Uploading...' : '📤 Upload .tex Template'}
               </label>
               <div style={{ marginTop: '12px', fontSize: '13px', color: 'var(--text-muted)' }}>
                 Overwrites your current template in S3
               </div>
            </div>
          </div>
        </div>
      )}

      {/* Floating save bar */}
      <div style={{
        position: 'fixed', bottom: '24px', right: '40px',
        background: 'var(--bg-card)', border: '1px solid var(--border-accent)',
        borderRadius: 'var(--radius-lg)', padding: '12px 20px',
        boxShadow: 'var(--shadow-lg)', display: 'flex', gap: '12px', alignItems: 'center',
        zIndex: 50
      }}>
        <Link href="/profile" className="btn btn-ghost btn-sm">Cancel</Link>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : '💾 Save Changes'}
        </button>
      </div>
    </div>
  );
}
