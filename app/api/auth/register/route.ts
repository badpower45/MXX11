import { NextResponse } from 'next/server';
import { getRequestMetadata, logAuthAudit } from '@/lib/auth/audit';
import { createEmailVerificationToken, hashEmailVerificationToken } from '@/lib/auth/email-verification';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/password';
import { registerSchema } from '@/lib/auth/validation';
import { buildAppUrl, isMailConfigured, sendEmailVerificationEmail } from '@/lib/email';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid registration data' }, { status: 400 });
    }

    const existing = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
    if (existing) return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });

    const verificationToken = createEmailVerificationToken();
    const verificationHash = hashEmailVerificationToken(verificationToken);
    const requestMetadata = getRequestMetadata(request);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash: await hashPassword(parsed.data.password),
          emailVerifiedAt: new Date()
        },
        select: { id: true, email: true, name: true }
      });

      const token = await tx.emailVerificationToken.create({
        data: {
          userId: user.id,
          tokenHash: verificationHash,
          expiresAt
        },
        select: {
          id: true
        }
      });

      await logAuthAudit({
        tx,
        action: 'EMAIL_VERIFICATION_ISSUED',
        userId: user.id,
        email: user.email,
        ...requestMetadata
      });

      return {
        user,
        tokenId: token.id
      };
    });

    const verificationUrl = buildAppUrl(`/verify-email?token=${verificationToken}`, request);
    let emailSent = false;

    if (isMailConfigured()) {
      try {
        await sendEmailVerificationEmail({
          to: {
            email: created.user.email,
            name: created.user.name
          },
          verificationUrl,
          expiresAt
        });
        emailSent = true;
      } catch (mailError) {
        console.error('Failed to send verification email. Continuing since account is auto-verified.', mailError);
      }
    }

    return NextResponse.json(
      {
        ok: true,
        user: created.user,
        emailSent,
        expiresAt: expiresAt.toISOString(),
        message: 'Account created and verified successfully.'
      },
      { status: 201 }
    );
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Unable to create account.' }, { status: 500 });
  }
}
