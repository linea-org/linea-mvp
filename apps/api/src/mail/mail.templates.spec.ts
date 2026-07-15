import {
  approvalRequiredEmail,
  escapeHtml,
  executionFailedEmail,
  invitationEmail,
  loginDetectedEmail,
  otpVerificationEmail,
  verificationEmail,
  welcomeEmail,
  type RenderedEmail,
} from './mail.templates.js';

describe('mail templates', () => {
  const samples: RenderedEmail[] = [
    verificationEmail({ name: 'Ada', verifyUrl: 'https://x/verify?token=abc' }),
    invitationEmail({
      inviterName: 'Ada',
      workspaceName: 'Acme',
      role: 'admin',
      inviteUrl: 'https://x/invites/abc',
    }),
    otpVerificationEmail({ code: '123456' }),
    loginDetectedEmail({
      time: 'now',
      ipAddress: '1.2.3.4',
      secureAccountUrl: 'https://x/account/security',
    }),
    welcomeEmail({ name: 'Ada', ctaUrl: 'https://x' }),
    executionFailedEmail({
      workflowName: 'wf',
      error: 'boom',
      executionUrl: 'https://x/e',
    }),
    approvalRequiredEmail({
      workflowName: 'wf',
      message: 'ok?',
      executionUrl: 'https://x/e',
    }),
  ];

  it('every template renders a non-empty subject and html document', () => {
    for (const email of samples) {
      expect(email.subject.length).toBeGreaterThan(0);
      expect(email.html).toContain('<!doctype html>');
      expect(email.html).toContain('Linea');
    }
  });

  it('escapes caller-supplied values to prevent HTML injection', () => {
    const evil = '<script>alert(1)</script>';
    const email = invitationEmail({
      inviterName: evil,
      workspaceName: evil,
      role: 'admin',
      inviteUrl: 'https://x/invites/abc',
    });
    expect(email.html).not.toContain('<script>');
    expect(email.html).toContain('&lt;script&gt;');
  });

  it('escapeHtml handles all sensitive characters', () => {
    expect(escapeHtml(`&<>"'`)).toBe('&amp;&lt;&gt;&quot;&#39;');
  });

  it('omits optional login-detected rows that are not provided', () => {
    const email = loginDetectedEmail({
      time: 'now',
      secureAccountUrl: 'https://x/account/security',
    });
    expect(email.html).toContain('Time');
    expect(email.html).not.toContain('IP address');
  });
});
