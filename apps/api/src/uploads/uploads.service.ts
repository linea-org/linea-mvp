import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';
import * as path from 'path';

const ALLOWED_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/pdf',
  'text/plain',
  'text/csv',
  'text/markdown',
  'application/json',
  'application/zip',
  'application/x-zip-compressed',
  'video/mp4',
  'audio/mpeg',
]);

const MAX_SIZE = 25 * 1024 * 1024; // 25 MB

@Injectable()
export class UploadsService {
  private readonly s3: S3Client | null;
  private readonly bucket: string;
  private readonly publicBase: string;

  constructor(private readonly config: ConfigService) {
    const accountId = config.get<string>('R2_ACCOUNT_ID');
    const accessKeyId = config.get<string>('R2_ACCESS_KEY_ID');
    const secretAccessKey = config.get<string>('R2_SECRET_ACCESS_KEY');
    this.bucket = config.get<string>('R2_BUCKET') ?? '';
    this.publicBase = config.get<string>('R2_PUBLIC_URL') ?? '';

    if (accountId && accessKeyId && secretAccessKey && this.bucket) {
      this.s3 = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
    } else {
      this.s3 = null;
    }
  }

  async presign(
    workspaceId: string,
    userId: string,
    filename: string,
    contentType: string,
    size: number,
  ): Promise<{ presignedUrl: string; publicUrl: string; key: string }> {
    if (!this.s3) {
      throw new BadRequestException(
        'File uploads are not configured on this server',
      );
    }
    if (!ALLOWED_TYPES.has(contentType)) {
      throw new BadRequestException('File type not allowed');
    }
    if (size > MAX_SIZE) {
      throw new BadRequestException('File too large (max 25 MB)');
    }

    const ext = path.extname(filename).toLowerCase();
    const key = `uploads/${workspaceId}/${userId}/${randomUUID()}${ext}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
      ContentLength: size,
    });

    const presignedUrl = await getSignedUrl(this.s3, command, {
      expiresIn: 300,
    });
    const publicUrl = this.publicBase ? `${this.publicBase}/${key}` : '';

    return { presignedUrl, publicUrl, key };
  }
}
