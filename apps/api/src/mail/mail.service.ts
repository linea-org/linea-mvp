import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import {
  approvalRequiredEmail,
  executionFailedEmail,
  invitationEmail,
  loginDetectedEmail,
  otpVerificationEmail,
  verificationEmail,
  welcomeEmail,
  type OtpPurpose,
  type RenderedEmail,
} from './mail.templates.js';

/**
 * Sends transactional email via Resend.
 *
 * Callers use the action-specific methods below (typed opts, no HTML). Those
 * resolve config-dependent values (URLs, sender) and hand a rendered template
 * to `deliver`, which is the single place that talks to the provider.
 */
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly resend: Resend | null;
  private readonly from: string;
  private readonly webUrl: string;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;
    this.from =
      config.get<string>('RESEND_FROM') ?? 'Linea <noreply@getlinea.app>';
    this.webUrl = (
      config.get<string>('WEB_URL') ?? 'https://platform.getlinea.app'
    ).replace(/\/+$/, '');

    if (!this.resend) {
      this.logger.warn(
        'RESEND_API_KEY not set — emails will be logged instead of sent',
      );
    }
  }

  sendVerification(opts: { toEmail: string; name?: string; token: string }) {
    return this.deliver(
      opts.toEmail,
      verificationEmail({
        name: opts.name,
        verifyUrl: `${this.webUrl}/verify-email?token=${encodeURIComponent(opts.token)}`,
      }),
    );
  }

  sendInvitation(opts: {
    toEmail: string;
    workspaceName: string;
    role: string;
    token: string;
    inviterName: string;
  }) {
    return this.deliver(
      opts.toEmail,
      invitationEmail({
        inviterName: opts.inviterName,
        workspaceName: opts.workspaceName,
        role: opts.role,
        inviteUrl: `${this.webUrl}/invites/${opts.token}`,
      }),
    );
  }

  sendOtpVerification(opts: {
    toEmail: string;
    code: string;
    purpose?: OtpPurpose;
    expiresInMinutes?: number;
  }) {
    return this.deliver(
      opts.toEmail,
      otpVerificationEmail({
        code: opts.code,
        purpose: opts.purpose,
        expiresInMinutes: opts.expiresInMinutes,
      }),
    );
  }

  sendLoginDetected(opts: {
    toEmail: string;
    name?: string;
    time?: Date;
    device?: string;
    location?: string;
    ipAddress?: string;
  }) {
    return this.deliver(
      opts.toEmail,
      loginDetectedEmail({
        name: opts.name,
        time: (opts.time ?? new Date()).toUTCString(),
        device: opts.device,
        location: opts.location,
        ipAddress: opts.ipAddress,
        secureAccountUrl: `${this.webUrl}/account/security`,
      }),
    );
  }

  sendWelcome(opts: { toEmail: string; name?: string }) {
    return this.deliver(
      opts.toEmail,
      welcomeEmail({ name: opts.name, ctaUrl: this.webUrl }),
    );
  }

  sendExecutionFailed(opts: {
    toEmail: string;
    workflowName: string;
    executionId: string;
    workspaceId: string;
    podId: string;
    error: string;
  }) {
    return this.deliver(
      opts.toEmail,
      executionFailedEmail({
        workflowName: opts.workflowName,
        error: opts.error,
        executionUrl: this.executionUrl(opts),
      }),
    );
  }

  sendApprovalRequired(opts: {
    toEmail: string;
    workflowName: string;
    executionId: string;
    workspaceId: string;
    podId: string;
    message: string;
  }) {
    return this.deliver(
      opts.toEmail,
      approvalRequiredEmail({
        workflowName: opts.workflowName,
        message: opts.message,
        executionUrl: this.executionUrl(opts),
      }),
    );
  }

  private executionUrl(opts: {
    workspaceId: string;
    podId: string;
    executionId: string;
  }): string {
    return `${this.webUrl}/workspaces/${opts.workspaceId}/pods/${opts.podId}/executions/${opts.executionId}`;
  }

  /**
   * Delivers a rendered email. Never throws — a failed email must not break the
   * calling flow. When delivery is disabled (no `RESEND_API_KEY`) the email is
   * logged instead of silently dropped, so it stays visible in development.
   */
  private async deliver(to: string, email: RenderedEmail): Promise<void> {
    if (!this.resend) {
      this.logger.log(
        `Email not sent (delivery disabled): "${email.subject}" → ${to}`,
      );
      return;
    }
    try {
      await this.resend.emails.send({
        from: this.from,
        to,
        subject: email.subject,
        html: email.html,
      });
    } catch (err) {
      this.logger.error(`Failed to send "${email.subject}" to ${to}: ${err}`);
    }
  }
}
