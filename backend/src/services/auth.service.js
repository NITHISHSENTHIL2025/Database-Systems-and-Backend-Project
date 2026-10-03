import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';
import { AppError } from '../utils/http.js';
import { writeAudit } from './audit.service.js';
import { generateUniqueLoginKey } from '../utils/loginKey.js';

export function publicUser(user) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    loginKey: user.loginKey || null
  };
}

function registrationOtpHash(email, otp) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`registration:${String(email).toLowerCase()}:${otp}`)
    .digest('hex');
}

function recoveryOtpHash(userId, purpose, otp) {
  return crypto
    .createHmac('sha256', env.jwtSecret)
    .update(`${userId}:${purpose}:${otp}`)
    .digest('hex');
}

function safeHashEqual(actualHash, expectedHash) {
  const actual = Buffer.from(String(actualHash || ''), 'hex');
  const expected = Buffer.from(String(expectedHash || ''), 'hex');

  return (
    actual.length > 0 &&
    actual.length === expected.length &&
    crypto.timingSafeEqual(actual, expected)
  );
}

async function sendBrevoEmail({ toEmail, toName, subject, htmlContent }) {
  if (!env.brevoApiKey || !env.emailFrom) {
    throw new AppError(
      503,
      'Email service is temporarily unavailable. Check the Brevo configuration.'
    );
  }

  const response = await fetch(
    'https://api.brevo.com/v3/smtp/email',
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'api-key': env.brevoApiKey
      },
      body: JSON.stringify({
        sender: {
          email: env.emailFrom,
          name: env.emailFromName
        },
        to: [
          {
            email: toEmail,
            name: toName
          }
        ],
        subject,
        htmlContent
      })
    }
  );

  if (!response.ok) {
  const errorText = await response.text();

  console.error(
    'BREVO ERROR:',
    response.status,
    errorText
  );

  throw new AppError(
    502,
    'We could not send the email. Please try again.'
  );
}
}

async function sendRegistrationEmail(pending, otp) {
  await sendBrevoEmail({
    toEmail: pending.email,
    toName: pending.name,
    subject: 'Verify your GymFit account',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#f3392f">GYMFIT</div>
        <h2 style="margin:12px 0 8px">Verify your email</h2>
        <p style="line-height:1.6;color:#555">
          Hi ${pending.name}, use the six-digit verification code below to finish creating your GymFit account.
        </p>
        <div style="margin:24px 0;padding:18px;background:#111;color:#fff;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px">
          ${otp}
        </div>
        <p style="line-height:1.6;color:#555">
          This code expires in 10 minutes. Your Gym Key will only be generated after this verification succeeds.
        </p>
        <p style="line-height:1.6;color:#777;font-size:13px">
          If you did not create a GymFit account, you can ignore this email.
        </p>
      </div>
    `
  });
}

async function sendRecoveryEmail(user, otp) {
  await sendBrevoEmail({
    toEmail: user.email,
    toName: user.name,
    subject: 'GymFit Gym Key recovery code',
    htmlContent: `
      <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;color:#111">
        <div style="font-size:13px;font-weight:700;letter-spacing:2px;color:#f3392f">GYMFIT</div>
        <h2 style="margin:12px 0 8px">Recover your Gym Key</h2>
        <p style="line-height:1.6;color:#555">
          Use the six-digit code below to recover your Gym Key.
        </p>
        <div style="margin:24px 0;padding:18px;background:#111;color:#fff;text-align:center;font-size:32px;font-weight:700;letter-spacing:10px">
          ${otp}
        </div>
        <p style="line-height:1.6;color:#555">
          This code expires in 10 minutes.
        </p>
        <p style="line-height:1.6;color:#777;font-size:13px">
          If you did not request this, you can ignore this email.
        </p>
      </div>
    `
  });
}

export async function requestRegistration(input) {
  const email = input.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: { email },
    select: { id: true }
  });

  if (existingUser) {
    throw new AppError(
      409,
      'An account with this email already exists. Sign in instead.'
    );
  }

  const existingPending =
    await prisma.pendingRegistration.findUnique({
      where: { email }
    });

  if (existingPending) {
    const elapsedMs =
      Date.now() - existingPending.lastSentAt.getTime();

    if (elapsedMs < 60 * 1000) {
      const waitSeconds = Math.max(
        1,
        60 - Math.floor(elapsedMs / 1000)
      );

      throw new AppError(
        429,
        `Please wait ${waitSeconds} seconds before requesting another OTP.`
      );
    }
  }

  const otp = String(
    crypto.randomInt(100000, 1000000)
  );

  const now = new Date();
  const expiresAt = new Date(
    now.getTime() + 10 * 60 * 1000
  );

  const pending =
    await prisma.pendingRegistration.upsert({
      where: { email },
      update: {
        name: input.name.trim(),
        phone: input.phone?.trim() || null,
        goal: input.goal,
        codeHash: registrationOtpHash(email, otp),
        attempts: 0,
        expiresAt,
        lastSentAt: now
      },
      create: {
        name: input.name.trim(),
        email,
        phone: input.phone?.trim() || null,
        goal: input.goal,
        codeHash: registrationOtpHash(email, otp),
        attempts: 0,
        expiresAt,
        lastSentAt: now
      }
    });

  try {
    await sendRegistrationEmail(pending, otp);
  } catch (error) {
    await prisma.pendingRegistration
      .update({
        where: { email },
        data: {
          expiresAt: new Date(0),
          lastSentAt: new Date(0)
        }
      })
      .catch(() => {});

    throw error;
  }

  return {
    ok: true,
    email,
    message: 'Verification code sent to your email.',
    expiresInSeconds: 600,
    resendAfterSeconds: 60
  };
}

export async function verifyRegistration(emailInput, otpInput) {
  const email = String(emailInput || '')
    .trim()
    .toLowerCase();

  const otp = String(otpInput || '').trim();

  const pending =
    await prisma.pendingRegistration.findUnique({
      where: { email }
    });

  if (!pending) {
    throw new AppError(
      400,
      'Registration request not found. Start again.'
    );
  }

  if (pending.expiresAt < new Date()) {
    throw new AppError(
      400,
      'OTP expired. Request a new verification code.'
    );
  }

  if (pending.attempts >= 5) {
    throw new AppError(
      429,
      'Too many incorrect attempts. Request a new OTP.'
    );
  }

  const valid = safeHashEqual(
    pending.codeHash,
    registrationOtpHash(email, otp)
  );

  if (!valid) {
    await prisma.pendingRegistration.update({
      where: { email },
      data: {
        attempts: {
          increment: 1
        }
      }
    });

    throw new AppError(
      400,
      'Incorrect OTP.'
    );
  }

  const passwordHash = await bcrypt.hash(
    crypto.randomBytes(32).toString('hex'),
    12
  );

  const user = await prisma.$transaction(
    async tx => {
      const existingUser = await tx.user.findUnique({
        where: { email },
        select: { id: true }
      });

      if (existingUser) {
        throw new AppError(
          409,
          'An account with this email already exists.'
        );
      }

      const loginKey =
        await generateUniqueLoginKey(tx);

      const createdUser = await tx.user.create({
        data: {
          name: pending.name,
          email: pending.email,
          loginKey,
          phone: pending.phone,
          passwordHash,
          role: 'MEMBER',
          status: 'ACTIVE',
          member: {
            create: {
              goal: pending.goal
            }
          }
        }
      });

      await tx.pendingRegistration.delete({
        where: { id: pending.id }
      });

      return createdUser;
    }
  );

  await writeAudit({
    actorUserId: user.id,
    action: 'REGISTER',
    entity: 'User',
    entityId: user.id,
    metadata: {
      emailVerified: true,
      verification: 'EMAIL_OTP',
      loginMethod: 'GYM_KEY_ONLY'
    }
  });

  return user;
}

export async function loginByKey(loginKey) {
  const key = String(loginKey || '').trim();

  const user = await prisma.user.findUnique({
    where: { loginKey: key }
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(
      401,
      'Invalid Gym Key.'
    );
  }

  await writeAudit({
    actorUserId: user.id,
    action: 'LOGIN',
    entity: 'User',
    entityId: user.id,
    metadata: {
      method: 'GYM_KEY_ONLY'
    }
  });

  return user;
}

export async function requestRecovery(emailInput) {
  const email = String(emailInput || '')
    .trim()
    .toLowerCase();

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || user.status !== 'ACTIVE') {
    return {
      ok: true,
      message:
        'If that email belongs to an active account, an OTP has been sent.'
    };
  }

  const purpose = 'GYM_KEY';
  const otp = String(
    crypto.randomInt(100000, 1000000)
  );

  await sendRecoveryEmail(user, otp);

  await prisma.recoveryCode.updateMany({
    where: {
      userId: user.id,
      purpose,
      usedAt: null
    },
    data: {
      usedAt: new Date()
    }
  });

  await prisma.recoveryCode.create({
    data: {
      userId: user.id,
      purpose,
      codeHash: recoveryOtpHash(
        user.id,
        purpose,
        otp
      ),
      expiresAt: new Date(
        Date.now() + 10 * 60 * 1000
      )
    }
  });

  return {
    ok: true,
    message: 'OTP sent to your registered email.'
  };
}

export async function verifyRecovery(
  emailInput,
  otpInput
) {
  const email = String(emailInput || '')
    .trim()
    .toLowerCase();

  const otp = String(otpInput || '').trim();
  const purpose = 'GYM_KEY';

  const user = await prisma.user.findUnique({
    where: { email }
  });

  if (!user || user.status !== 'ACTIVE') {
    throw new AppError(
      400,
      'Recovery request is invalid or expired.'
    );
  }

  const row =
    await prisma.recoveryCode.findFirst({
      where: {
        userId: user.id,
        purpose,
        usedAt: null
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

  if (!row || row.expiresAt < new Date()) {
    throw new AppError(
      400,
      'OTP expired. Request a new one.'
    );
  }

  if (row.attempts >= 5) {
    throw new AppError(
      429,
      'Too many incorrect attempts. Request a new OTP.'
    );
  }

  const valid = safeHashEqual(
    row.codeHash,
    recoveryOtpHash(
      user.id,
      purpose,
      otp
    )
  );

  if (!valid) {
    await prisma.recoveryCode.update({
      where: {
        id: row.id
      },
      data: {
        attempts: {
          increment: 1
        }
      }
    });

    throw new AppError(
      400,
      'Incorrect OTP.'
    );
  }

  await prisma.recoveryCode.update({
    where: {
      id: row.id
    },
    data: {
      usedAt: new Date()
    }
  });

  await writeAudit({
    actorUserId: user.id,
    action: 'RECOVERY_KEY_REVEALED',
    entity: 'User',
    entityId: user.id
  });

  return {
    ok: true,
    loginKey: user.loginKey,
    message: 'Gym Key recovered successfully.'
  };
}
