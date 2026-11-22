import { prisma } from '@/lib/db/client';

interface AuditInput {
  action: string;
  userId?: string;
  details?: Record<string, unknown>;
  ip?: string;
}

export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditEvent.create({
      data: {
        action: input.action,
        userId: input.userId,
        details: input.details ? (input.details as any) : undefined,
        ip: input.ip,
      },
    });
  } catch (error) {
    console.error('Audit log error:', error);
  }
}
