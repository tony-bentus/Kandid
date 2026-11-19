import { escapeHtml } from './escape-html.js';

describe('escapeHtml', () => {
  it('escapa os cinco caracteres obrigatórios na ordem correta', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('não escapa duas vezes entidades já presentes na entrada', () => {
    expect(escapeHtml('&amp;')).toBe('&amp;amp;');
  });

  it('neutraliza payloads de XSS comuns do snapshot', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe(
      '&lt;script&gt;alert(1)&lt;/script&gt;',
    );
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe(
      '&lt;img src=x onerror=alert(1)&gt;',
    );
    expect(escapeHtml('javascript:alert(1)')).toBe('javascript:alert(1)');
  });

  it('preserva Unicode e não altera a string de entrada', () => {
    const value = 'São Paulo —Currículo— 日本語';
    expect(escapeHtml(value)).toBe(value);
  });
});
