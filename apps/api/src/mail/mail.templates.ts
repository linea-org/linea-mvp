/**
 * Email templates.
 *
 * Each exported `*Email` function is pure: it takes fully-resolved, typed props
 * (URLs already built — no config, no secrets, no I/O) and returns a rendered
 * `{ subject, html }` pair. `MailService` owns config, URL building and delivery;
 * templates only render. This keeps templates trivial to unit test.
 *
 * Every caller-supplied string is passed through `escapeHtml` before it is
 * interpolated into HTML, so user-controlled values (names, workspaces, error
 * text, …) can never inject markup.
 */

const COLORS = {
  text: '#1a1a1a',
  muted: '#6b7280',
  border: '#e5e7eb',
  bg: '#f4f4f5',
  card: '#ffffff',
  brand: '#000000',
  brandText: '#ffffff',
  danger: '#fef2f2',
  dangerBorder: '#fecaca',
} as const;

export interface RenderedEmail {
  subject: string;
  html: string;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function button(href: string, label: string): string {
  return `<a href="${href}" style="display:inline-block;padding:12px 24px;background:${COLORS.brand};color:${COLORS.brandText};border-radius:8px;text-decoration:none;font-weight:600;font-size:14px">${escapeHtml(label)}</a>`;
}

function greeting(name?: string): string {
  return `<p style="margin:0 0 16px">Hi${name ? ` ${escapeHtml(name)}` : ''},</p>`;
}

function layout(opts: {
  preview: string;
  heading: string;
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light" />
  </head>
  <body style="margin:0;padding:0;background:${COLORS.bg};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:${COLORS.text}">
    <span style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preview)}</span>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLORS.bg};padding:32px 12px">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:12px">
            <tr>
              <td style="padding:28px 32px 0">
                <div style="font-size:18px;font-weight:700;letter-spacing:-0.02em">Linea</div>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px 8px">
                <h1 style="margin:0;font-size:20px;font-weight:600;line-height:1.3">${escapeHtml(opts.heading)}</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 28px;font-size:14px;line-height:1.6;color:${COLORS.text}">
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding:20px 32px;border-top:1px solid ${COLORS.border};font-size:12px;color:${COLORS.muted}">
                You're receiving this email because of activity on your Linea account.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export interface VerificationEmailProps {
  name?: string;
  verifyUrl: string;
}

export function verificationEmail(p: VerificationEmailProps): RenderedEmail {
  const body = `
    ${greeting(p.name)}
    <p style="margin:0 0 20px">Confirm your email address to finish setting up your Linea account.</p>
    <p style="margin:0 0 20px">${button(p.verifyUrl, 'Verify email')}</p>
    <p style="margin:0 0 8px;color:${COLORS.muted}">Or paste this link into your browser:</p>
    <p style="margin:0 0 20px;word-break:break-all"><a href="${p.verifyUrl}" style="color:${COLORS.text}">${escapeHtml(p.verifyUrl)}</a></p>
    <p style="margin:0;color:${COLORS.muted};font-size:12px">This link expires in 24 hours. If you didn't create a Linea account, you can safely ignore this email.</p>
  `;
  return {
    subject: 'Verify your email address',
    html: layout({
      preview: 'Verify your email to finish setting up Linea',
      heading: 'Verify your email',
      bodyHtml: body,
    }),
  };
}

export interface InvitationEmailProps {
  inviterName: string;
  workspaceName: string;
  role: string;
  inviteUrl: string;
}

export function invitationEmail(p: InvitationEmailProps): RenderedEmail {
  const body = `
    <p style="margin:0 0 20px"><strong>${escapeHtml(p.inviterName)}</strong> has invited you to join <strong>${escapeHtml(p.workspaceName)}</strong> as a <strong>${escapeHtml(p.role)}</strong> on Linea.</p>
    <p style="margin:0 0 20px">${button(p.inviteUrl, 'Accept invite')}</p>
    <p style="margin:0;color:${COLORS.muted};font-size:12px">This invitation expires in 7 days. If you weren't expecting it, you can safely ignore this email.</p>
  `;
  return {
    subject: `${p.inviterName} invited you to ${p.workspaceName} on Linea`,
    html: layout({
      preview: `Join ${p.workspaceName} on Linea`,
      heading: `Join ${escapeHtml(p.workspaceName)}`,
      bodyHtml: body,
    }),
  };
}

export type OtpPurpose =
  'sign in' | 'verify your email' | 'reset your password';

export interface OtpVerificationEmailProps {
  code: string;
  purpose?: OtpPurpose;
  expiresInMinutes?: number;
}

export function otpVerificationEmail(
  p: OtpVerificationEmailProps,
): RenderedEmail {
  const purpose = p.purpose ?? 'sign in';
  const minutes = p.expiresInMinutes ?? 10;
  const body = `
    <p style="margin:0 0 20px">Use the code below to ${escapeHtml(purpose)}.</p>
    <div style="margin:0 0 20px;padding:16px;background:${COLORS.bg};border:1px solid ${COLORS.border};border-radius:8px;text-align:center;font-family:'SF Mono',ui-monospace,Menlo,monospace;font-size:28px;font-weight:700;letter-spacing:6px">${escapeHtml(p.code)}</div>
    <p style="margin:0;color:${COLORS.muted};font-size:12px">This code expires in ${minutes} minutes. If you didn't request it, you can safely ignore this email.</p>
  `;
  return {
    subject: 'Your Linea verification code',
    html: layout({
      preview: `Your verification code (expires in ${minutes} minutes)`,
      heading: 'Your verification code',
      bodyHtml: body,
    }),
  };
}

export interface LoginDetectedEmailProps {
  name?: string;
  time: string;
  device?: string;
  location?: string;
  ipAddress?: string;
  secureAccountUrl: string;
}

export function loginDetectedEmail(p: LoginDetectedEmailProps): RenderedEmail {
  const rows: Array<[string, string | undefined]> = [
    ['Time', p.time],
    ['Device', p.device],
    ['Location', p.location],
    ['IP address', p.ipAddress],
  ];
  const details = rows
    .filter((row): row is [string, string] => Boolean(row[1]))
    .map(
      ([label, value]) =>
        `<tr><td style="padding:4px 16px 4px 0;color:${COLORS.muted};white-space:nowrap">${label}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`,
    )
    .join('');
  const body = `
    ${greeting(p.name)}
    <p style="margin:0 0 16px">We noticed a new sign-in to your Linea account:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 20px;font-size:13px">${details}</table>
    <p style="margin:0 0 20px">If this was you, no action is needed. If you don't recognise it, secure your account now:</p>
    <p style="margin:0">${button(p.secureAccountUrl, 'Secure your account')}</p>
  `;
  return {
    subject: 'New sign-in to your Linea account',
    html: layout({
      preview: 'New sign-in detected on your Linea account',
      heading: 'New sign-in detected',
      bodyHtml: body,
    }),
  };
}

export interface WelcomeEmailProps {
  name?: string;
  ctaUrl: string;
}

export function welcomeEmail(p: WelcomeEmailProps): RenderedEmail {
  const body = `
    ${greeting(p.name)}
    <p style="margin:0 0 20px">Welcome to Linea — your account is ready. Build and automate your first workflow in minutes.</p>
    <p style="margin:0 0 20px">${button(p.ctaUrl, 'Open Linea')}</p>
    <p style="margin:0;color:${COLORS.muted};font-size:12px">Need a hand getting started? Just reply to this email.</p>
  `;
  return {
    subject: 'Welcome to Linea',
    html: layout({
      preview: 'Your Linea account is ready',
      heading: 'Welcome to Linea',
      bodyHtml: body,
    }),
  };
}

export interface ExecutionFailedEmailProps {
  workflowName: string;
  error: string;
  executionUrl: string;
}

export function executionFailedEmail(
  p: ExecutionFailedEmailProps,
): RenderedEmail {
  const body = `
    <p style="margin:0 0 16px">Your workflow <strong>${escapeHtml(p.workflowName)}</strong> encountered an error.</p>
    <div style="margin:0 0 20px;padding:12px;background:${COLORS.danger};border:1px solid ${COLORS.dangerBorder};border-radius:6px;font-family:ui-monospace,Menlo,monospace;font-size:13px;white-space:pre-wrap;word-break:break-word">${escapeHtml(p.error.slice(0, 500))}</div>
    <p style="margin:0">${button(p.executionUrl, 'View execution')}</p>
  `;
  return {
    subject: `Execution failed: ${p.workflowName}`,
    html: layout({
      preview: `${p.workflowName} failed`,
      heading: 'Execution failed',
      bodyHtml: body,
    }),
  };
}

export interface ApprovalRequiredEmailProps {
  workflowName: string;
  message: string;
  executionUrl: string;
}

export function approvalRequiredEmail(
  p: ApprovalRequiredEmailProps,
): RenderedEmail {
  const body = `
    <p style="margin:0 0 16px">Workflow <strong>${escapeHtml(p.workflowName)}</strong> is paused and waiting for your approval.</p>
    <p style="margin:0 0 20px">${escapeHtml(p.message)}</p>
    <p style="margin:0">${button(p.executionUrl, 'Review &amp; approve')}</p>
  `;
  return {
    subject: `Approval required: ${p.workflowName}`,
    html: layout({
      preview: `${p.workflowName} needs your approval`,
      heading: 'Approval required',
      bodyHtml: body,
    }),
  };
}
