import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      config.get<string>('RESEND_FROM') ?? 'Linea <noreply@getlinea.app>';
    this.webUrl =
      config.get<string>('WEB_URL') ?? 'https://platform.getlinea.app';

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not set — email delivery is disabled');
    }
  }

  async sendInvite(opts: {
    toEmail: string;
    workspaceName: string;
    role: string;
    token: string;
    inviterName: string;
  }) {
    const inviteUrl = `${this.webUrl}/invites/${opts.token}`;
    await this.send({
      to: opts.toEmail,
      subject: `${opts.inviterName} invited you to ${opts.workspaceName} on Linea`,
      html: `
        <p>Hi,</p>
        <p><strong>${opts.inviterName}</strong> has invited you to join <strong>${opts.workspaceName}</strong> as a <strong>${opts.role}</strong>.</p>
        <p><a href="${inviteUrl}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;border-radius:6px;text-decoration:none">Accept invite</a></p>
        <p style="color:#666;font-size:12px">This link expires in 7 days. If you did not expect this invitation, you can safely ignore this email.</p>
      `,
    });
  }

  async sendExecutionFailed(opts: {
    toEmail: string;
    workflowName: string;
    executionId: string;
    workspaceId: string;
    podId: string;
    error: string;
  }) {
    const url = `${this.webUrl}/workspaces/${opts.workspaceId}/pods/${opts.podId}/executions/${opts.executionId}`;
    await this.send({
      to: opts.toEmail,
      subject: `Execution failed: ${opts.workflowName}`,
      html: `
        <p>Your workflow <strong>${opts.workflowName}</strong> encountered an error.</p>
        <p style="background:#fef2f2;border:1px solid #fecaca;padding:10px;border-radius:4px;font-family:monospace;font-size:13px">${escHtml(opts.error.slice(0, 500))}</p>
        <p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;border-radius:6px;text-decoration:none">View execution</a></p>
      `,
    });
  }

  async sendApprovalRequired(opts: {
    toEmail: string;
    workflowName: string;
    executionId: string;
    workspaceId: string;
    podId: string;
    message: string;
  }) {
    const url = `${this.webUrl}/workspaces/${opts.workspaceId}/pods/${opts.podId}/executions/${opts.executionId}`;
    await this.send({
      to: opts.toEmail,
      subject: `Approval required: ${opts.workflowName}`,
      html: `
        <p>Workflow <strong>${opts.workflowName}</strong> is paused and waiting for your approval.</p>
        <p>${escHtml(opts.message)}</p>
        <p><a href="${url}" style="display:inline-block;padding:10px 20px;background:#000;color:#fff;border-radius:6px;text-decoration:none">Review &amp; approve</a></p>
      `,
    });
  }

  private async send(opts: { to: string; subject: string; html: string }) {
    if (!this.resend) return;
    try {
      await this.resend.emails.send({ from: this.from, ...opts });
    } catch (err) {
      // Log but never throw — email failure must not break the calling flow
      this.logger.error(`Failed to send email to ${opts.to}: ${err}`);
    }
  }
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
