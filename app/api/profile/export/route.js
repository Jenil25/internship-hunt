import { auth } from '@/lib/auth';
import { getProfile } from '@/lib/db';
import { NextResponse } from 'next/server';

function toMarkdown(data) {
  const info = data.profile || {};
  const contact = info.contact || {};
  const skills = info.skills || {};
  const education = info.education || [];
  const experience = data.experience || [];
  const projects = data.projects || [];

  let md = `# ${info.name || 'Profile'}\n\n`;

  // Contact
  const contactParts = [contact.email, contact.phone, contact.location].filter(Boolean);
  if (contactParts.length) md += contactParts.join(' | ') + '\n';
  if (contact.linkedin) md += `[LinkedIn](${contact.linkedin})`;
  if (contact.github) md += `${contact.linkedin ? ' | ' : ''}[GitHub](${contact.github})`;
  if (contact.linkedin || contact.github) md += '\n';
  md += '\n---\n\n';

  // Education
  if (education.length) {
    md += '## Education\n\n';
    education.forEach(edu => {
      md += `### ${edu.institution || 'Institution'}\n`;
      md += `- **Degree:** ${edu.degree || 'N/A'}\n`;
      if (edu.gpa) md += `- **GPA:** ${edu.gpa}\n`;
      if (edu.grad_date) md += `- **Graduation:** ${edu.grad_date}\n`;
      if (edu.relevant_coursework?.length) {
        md += `- **Coursework:** ${edu.relevant_coursework.join(', ')}\n`;
      }
      md += '\n';
    });
  }

  // Experience
  if (experience.length) {
    md += '## Experience\n\n';
    experience.forEach(exp => {
      md += `### ${exp.role || 'Role'} — ${exp.company || 'Company'}\n`;
      if (exp.dates) md += `*${exp.dates}*\n\n`;
      if (exp.summary_sentence) md += `${exp.summary_sentence}\n\n`;
      if (exp.tech_stack?.length) md += `**Tech:** ${exp.tech_stack.join(', ')}\n\n`;
      if (exp.bullet_points_pool?.length) {
        exp.bullet_points_pool.forEach(bp => { md += `- ${bp}\n`; });
        md += '\n';
      }
    });
  }

  // Projects
  if (projects.length) {
    md += '## Projects\n\n';
    projects.forEach(proj => {
      md += `### ${proj.project_name || 'Project'}`;
      if (proj.role) md += ` — ${proj.role}`;
      md += '\n';
      if (proj.dates) md += `*${proj.dates}*\n\n`;
      if (proj.summary_sentence) md += `${proj.summary_sentence}\n\n`;
      if (proj.tech_stack?.length) md += `**Tech:** ${proj.tech_stack.join(', ')}\n\n`;
      if (proj.github_links?.length) md += `**GitHub:** ${proj.github_links.join(', ')}\n\n`;
      if (proj.live_url) md += `**Live:** ${proj.live_url}\n\n`;
      if (proj.bullet_points_pool?.length) {
        proj.bullet_points_pool.forEach(bp => { md += `- ${bp}\n`; });
        md += '\n';
      }
    });
  }

  // Skills
  if (Object.keys(skills).length) {
    md += '## Skills\n\n';
    Object.entries(skills).forEach(([cat, items]) => {
      const label = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      md += `- **${label}:** ${(Array.isArray(items) ? items : []).join(', ')}\n`;
    });
    md += '\n';
  }

  return md;
}

function toPlainText(data) {
  const info = data.profile || {};
  const contact = info.contact || {};
  const skills = info.skills || {};
  const education = info.education || [];
  const experience = data.experience || [];
  const projects = data.projects || [];

  let txt = `${info.name || 'Profile'}\n${'='.repeat((info.name || 'Profile').length)}\n\n`;

  const contactParts = [contact.email, contact.phone, contact.location].filter(Boolean);
  if (contactParts.length) txt += contactParts.join(' | ') + '\n';
  if (contact.linkedin) txt += `LinkedIn: ${contact.linkedin}\n`;
  if (contact.github) txt += `GitHub: ${contact.github}\n`;
  txt += '\n';

  if (education.length) {
    txt += 'EDUCATION\n---------\n';
    education.forEach(edu => {
      txt += `${edu.institution || 'Institution'}\n`;
      txt += `  Degree: ${edu.degree || 'N/A'}\n`;
      if (edu.gpa) txt += `  GPA: ${edu.gpa}\n`;
      if (edu.grad_date) txt += `  Graduation: ${edu.grad_date}\n`;
      if (edu.relevant_coursework?.length) {
        txt += `  Coursework: ${edu.relevant_coursework.join(', ')}\n`;
      }
      txt += '\n';
    });
  }

  if (experience.length) {
    txt += 'EXPERIENCE\n----------\n';
    experience.forEach(exp => {
      txt += `${exp.role || 'Role'} at ${exp.company || 'Company'}`;
      if (exp.dates) txt += ` (${exp.dates})`;
      txt += '\n';
      if (exp.summary_sentence) txt += `  ${exp.summary_sentence}\n`;
      if (exp.tech_stack?.length) txt += `  Tech: ${exp.tech_stack.join(', ')}\n`;
      if (exp.bullet_points_pool?.length) {
        exp.bullet_points_pool.forEach(bp => { txt += `  • ${bp}\n`; });
      }
      txt += '\n';
    });
  }

  if (projects.length) {
    txt += 'PROJECTS\n--------\n';
    projects.forEach(proj => {
      txt += `${proj.project_name || 'Project'}`;
      if (proj.role) txt += ` (${proj.role})`;
      if (proj.dates) txt += ` — ${proj.dates}`;
      txt += '\n';
      if (proj.summary_sentence) txt += `  ${proj.summary_sentence}\n`;
      if (proj.tech_stack?.length) txt += `  Tech: ${proj.tech_stack.join(', ')}\n`;
      if (proj.github_links?.length) txt += `  GitHub: ${proj.github_links.join(', ')}\n`;
      if (proj.live_url) txt += `  Live: ${proj.live_url}\n`;
      if (proj.bullet_points_pool?.length) {
        proj.bullet_points_pool.forEach(bp => { txt += `  • ${bp}\n`; });
      }
      txt += '\n';
    });
  }

  if (Object.keys(skills).length) {
    txt += 'SKILLS\n------\n';
    Object.entries(skills).forEach(([cat, items]) => {
      const label = cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      txt += `${label}: ${(Array.isArray(items) ? items : []).join(', ')}\n`;
    });
  }

  return txt;
}

export async function GET(req) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const format = searchParams.get('format') || 'json';

  try {
    const profile = await getProfile(session.user.email);
    if (!profile) return NextResponse.json({ error: 'No profile found' }, { status: 404 });

    const data = profile.profile_json;
    const name = (data.profile?.name || 'profile').replace(/\s+/g, '_');

    if (format === 'markdown' || format === 'md') {
      return new NextResponse(toMarkdown(data), {
        headers: {
          'Content-Type': 'text/markdown; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}_profile.md"`,
        },
      });
    }

    if (format === 'text' || format === 'txt') {
      return new NextResponse(toPlainText(data), {
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'Content-Disposition': `attachment; filename="${name}_profile.txt"`,
        },
      });
    }

    // Default: JSON
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${name}_profile.json"`,
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
