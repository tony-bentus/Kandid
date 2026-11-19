import type { ResumeSnapshot } from '../../ats/engine/types.js';
import { renderResumeHtml } from './render-resume-html.js';

const makeSnapshot = (overrides: Partial<ResumeSnapshot> = {}): ResumeSnapshot => ({
  schemaVersion: '1.0',
  generatedAt: '2026-11-19T12:05:00.000Z',
  targetRole: 'Desenvolvedor Backend Sênior',
  candidate: {
    name: 'Nome Sobrenome',
    headline: 'Backend Developer',
    email: 'email@exemplo.com',
    phone: '+55 11 99999-9999',
    location: 'São Paulo, SP, Brasil',
    links: {
      linkedin: 'https://linkedin.com/in/usuario',
      github: 'https://github.com/usuario',
      portfolio: null,
    },
  },
  summary: 'Resumo profissional...',
  skills: [
    {
      name: 'Node.js',
      category: 'FRAMEWORK',
      level: 'ADVANCED',
      years: 5,
    },
  ],
  experiences: [
    {
      company: 'Acme',
      role: 'Backend Developer',
      employmentType: 'CLT',
      workModel: 'REMOTE',
      location: 'Remoto',
      startDate: '2021-03',
      endDate: null,
      current: true,
      highlights: ['Reduzi a latência da API em 40%'],
    },
  ],
  education: [
    {
      institution: 'Universidade X',
      degree: 'Bacharelado',
      fieldOfStudy: 'Ciência da Computação',
      startDate: '2015-02',
      endDate: '2019-12',
      current: false,
    },
  ],
  certifications: [
    { name: 'AWS Certified Developer', issuer: 'AWS', issueDate: '2023-06' },
  ],
  languages: [{ name: 'Inglês', proficiency: 'ADVANCED' }],
  projects: [],
  ...overrides,
});

const render = (snapshot: ResumeSnapshot): string =>
  renderResumeHtml({ snapshot });

const headings = (html: string): string[] =>
  [...html.matchAll(/<h2>(.*?)<\/h2>/g)].map((match) => match[1]);

describe('renderResumeHtml', () => {
  it('gera HTML5 completo, coluna única e com os títulos fixos na ordem', () => {
    const html = render(makeSnapshot());

    expect(html.startsWith('<!doctype html>')).toBe(true);
    expect(html).toContain('<html lang="pt-BR">');
    expect(html).toContain('<meta charset="utf-8">');
    expect(html).toContain('<head>');
    expect(html).toContain('<style>');
    expect(html).toContain('<title>');
    expect(html).toContain('<body>');
    expect(html.match(/<main>/g) ?? []).toHaveLength(1);
    expect(headings(html)).toEqual([
      'Resumo',
      'Habilidades',
      'Experiência Profissional',
      'Formação',
      'Certificações',
      'Idiomas',
    ]);
    expect(html).toContain('Node.js — FRAMEWORK — ADVANCED — 5 anos');
    expect(html).toContain('Inglês — ADVANCED');
  });

  it('omite seções vazias, inclusive o título, e nunca renderiza projects', () => {
    const html = render(
      makeSnapshot({
        summary: '   ',
        skills: [],
        experiences: [],
        education: [],
        certifications: [],
        languages: [],
        projects: [
          {
            name: 'TOKEN_DE_PROJETO_NAO_RENDERIZADO',
            description: 'Projeto não faz parte do HTML',
          },
        ],
      }),
    );

    expect(headings(html)).toEqual([]);
    expect(html).not.toContain('TOKEN_DE_PROJETO_NAO_RENDERIZADO');
    expect(html.endsWith('</html>\n')).toBe(true);
  });

  it('escapa & < > " e aspas simples em texto, título e atributos', () => {
    const html = render(
      makeSnapshot({
        targetRole: 'Dev & "Especialista"',
        candidate: {
          name: `<script>alert(1)</script> & "aspas" 'simples'`,
          links: {
            github: `https://exemplo.com/?q="x"&y='z'&a=<b>`,
          },
        },
        summary: '<img onerror=alert(1)> & mais',
      }),
    );

    expect(html).toContain(
      '&lt;script&gt;alert(1)&lt;/script&gt; &amp; &quot;aspas&quot; &#39;simples&#39;',
    );
    expect(html).toContain('&lt;img onerror=alert(1)&gt; &amp; mais');
    expect(html).toContain('&amp; &quot;Especialista&quot;');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('<img');
    expect(html).toContain('href="https://exemplo.com/?q=&quot;x&quot;&amp;y=&#39;z&#39;&amp;a=&lt;b&gt;"');
  });

  it('só transforma em link URLs http/https; javascript: vira texto/é omitido', () => {
    const html = render(
      makeSnapshot({
        candidate: {
          name: 'Nome',
          links: {
            linkedin: 'javascript:alert(1)',
            github: 'data:text/html;base64,PHNjcmlwdD4=',
            portfolio: 'https://portfolio.example.com/cv',
          },
        },
        certifications: [
          {
            name: 'Certificado',
            credentialUrl: 'javascript:alert(document.cookie)',
          },
        ],
      }),
    );

    expect(html).toContain(
      '<a href="https://portfolio.example.com/cv">Portfólio</a>',
    );
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('data:text/html');
    expect(html).not.toContain('href="javascript');
  });

  it('formata YYYY-MM, YYYY-MM-DD e current, sem inventar datas', () => {
    const html = render(
      makeSnapshot({
        experiences: [
          {
            company: 'Acme',
            role: 'Backend',
            startDate: '2021-03',
            endDate: '2023-08',
          },
          {
            company: 'Beta',
            role: 'Dev',
            startDate: '2024-01-09',
            endDate: null,
            current: false,
          },
          {
            company: 'Gamma',
            role: 'Dev',
            startDate: 'data-invalida',
            endDate: '2020-13-99',
          },
          {
            company: 'Delta',
            role: 'Dev',
            startDate: '2021-03',
            current: true,
          },
        ],
        education: [
          {
            institution: 'Universidade X',
            degree: 'Bacharelado',
            fieldOfStudy: 'Ciência da Computação',
            startDate: '2015-02-01',
            endDate: '2019-12-31',
          },
        ],
      }),
    );

    expect(html).toContain('03/2021 — 08/2023');
    expect(html).toContain('09/01/2024 — Atual');
    expect(html).toContain('01/02/2015 — 31/12/2019');
    expect(html).not.toContain('data-invalida');
    expect(html).not.toContain('2020-13-99');
    expect(html).toContain('03/2021 — Atual');
  });

  it('é determinístico e não depende de generatedAt, score ou relógio', () => {
    const first = makeSnapshot();
    const second = makeSnapshot({
      generatedAt: '2030-01-01T00:00:00.000Z',
    });

    expect(render(first)).toBe(render(first));
    expect(render(first)).toBe(render(second));
  });

  it('não contém elementos proibidos nem recursos externos', () => {
    const html = render(makeSnapshot());

    expect(html).not.toMatch(/<table|<img|<svg|<iframe|<script|<link|<form/i);
    expect(html).not.toMatch(/\bon\w+\s*=/i);
    expect(html).not.toContain('src=');
    expect(html).not.toContain('@import');
    expect(html).not.toContain('http://');
    expect(html).toContain('https://linkedin.com/in/usuario');
  });

  it('deriva o título do nome e, na ausência dele, do cargo alvo', () => {
    expect(render(makeSnapshot())).toContain(
      '<title>Nome Sobrenome — Currículo</title>',
    );
    expect(
      render(
        makeSnapshot({ candidate: { name: null }, targetRole: 'Backend & Dev' }),
      ),
    ).toContain('<title>Backend &amp; Dev — Currículo</title>');
  });
});
