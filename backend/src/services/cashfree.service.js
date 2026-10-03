import crypto from 'node:crypto';

import { prisma } from '../config/prisma.js';
import { env } from '../config/env.js';

import { AppError } from '../utils/http.js';

import {
  getMemberId
} from './member.service.js';

import {
  writeAudit
} from './audit.service.js';

import {
  generateAIWeek
} from './aiCoach.service.js';

import {
  publishEvent
} from './events.service.js';

const apiBase = () =>
  env.cashfreeMode === 'production'
    ? 'https://api.cashfree.com/pg'
    : 'https://sandbox.cashfree.com/pg';

function configured() {
  return Boolean(
    env.cashfreeAppId &&
    env.cashfreeSecretKey
  );
}

async function cashfree(
  path,
  options = {}
) {
  if (!configured()) {
    throw new AppError(
      503,
      'Online payment is temporarily unavailable. Please contact the gym.'
    );
  }

  const response = await fetch(
    `${apiBase()}${path}`,
    {
      ...options,

      headers: {
        'x-client-id':
          env.cashfreeAppId,

        'x-client-secret':
          env.cashfreeSecretKey,

        'x-api-version':
          env.cashfreeApiVersion,

        Accept:
          'application/json',

        ...(options.body
          ? {
              'Content-Type':
                'application/json'
            }
          : {}),

        ...(options.headers || {})
      }
    }
  );

  const body = await response
    .json()
    .catch(() => null);

  if (!response.ok) {
    console.error(
      'Cashfree error',
      response.status,
      body
    );

    throw new AppError(
      502,
      body?.message ||
        'Cashfree request failed.'
    );
  }

  return body;
}

function makeOrderId(memberId) {
  return `GF_${memberId}_${Date.now()}_${crypto
    .randomBytes(3)
    .toString('hex')}`;
}

async function findCurrentMembership(
  memberId
) {
  const now = new Date();

  return prisma.membership.findFirst({
    where: {
      memberId,

      status: 'ACTIVE',

      startDate: {
        lte: now
      },

      endDate: {
        gt: now
      }
    },

    include: {
      plan: true
    },

    orderBy: {
      endDate: 'desc'
    }
  });
}

function ensurePlanAllowed(
  current,
  nextPlan
) {
  if (!current) {
    return;
  }

  const endLabel =
    current.endDate.toLocaleDateString(
      'en-IN'
    );

  if (
    current.plan.kind ===
    nextPlan.kind
  ) {
    throw new AppError(
      409,
      `${current.plan.name} is already active until ${endLabel}.`
    );
  }

  const isUpgrade =
    current.plan.kind === 'AI' &&
    nextPlan.kind === 'PERSONAL';

  if (!isUpgrade) {
    throw new AppError(
      409,
      `Your ${current.plan.name} membership is active until ${endLabel}. You can choose another plan after it ends.`
    );
  }
}

export async function createOrder(
  user,
  planId
) {
  const memberId =
    await getMemberId(user.id);

  const plan =
    await prisma.membershipPlan.findFirst({
      where: {
        id: planId,
        active: true
      }
    });

  if (!plan) {
    throw new AppError(
      404,
      'Membership plan not found.'
    );
  }

  const current =
    await findCurrentMembership(
      memberId
    );

  ensurePlanAllowed(
    current,
    plan
  );

  const member =
    await prisma.member.findUnique({
      where: {
        id: memberId
      },

      include: {
        user: true
      }
    });

  if (!member) {
    throw new AppError(
      404,
      'Member not found.'
    );
  }

  const rawPhone =
    member.user.phone || '';

  const phone =
    rawPhone
      .replace(/\D/g, '')
      .slice(-10);

  if (!/^[6-9]\d{9}$/.test(phone)) {
    throw new AppError(
      400,
      'Add a valid 10-digit mobile number to your profile before payment.'
    );
  }

  const orderId =
    makeOrderId(memberId);

  const amount =
    Number(plan.price);

  const order =
    await cashfree('/orders', {
      method: 'POST',

      body: JSON.stringify({
        order_id: orderId,

        order_amount: amount,

        order_currency: 'INR',

        customer_details: {
          customer_id:
            `member_${memberId}`,

          customer_name:
            member.user.name,

          customer_email:
            member.user.email,

          customer_phone:
            phone
        },

        order_meta: {
          return_url:
            `${env.frontendUrl}/member/membership?order_id={order_id}`,

          ...(env.publicApiUrl
            ? {
                notify_url:
                  `${env.publicApiUrl.replace(
                    /\/$/,
                    ''
                  )}/api/payments/webhook`
              }
            : {})
        },

        order_note:
          `GymFit membership: ${plan.name}`,

        order_tags: {
          member_id:
            String(memberId),

          plan_id:
            String(plan.id)
        }
      })
    });

  await prisma.payment.create({
    data: {
      memberId,

      planId:
        plan.id,

      orderId,

      amount:
        plan.price,

      status:
        'PENDING',

      paymentSessionId:
        order.payment_session_id ||
        null
    }
  });

  await writeAudit({
    actorUserId:
      user.id,

    action:
      'CREATE_PAYMENT_ORDER',

    entity:
      'Payment',

    entityId:
      orderId,

    metadata: {
      planId:
        plan.id,

      amount
    }
  });

  return {
    orderId,

    paymentSessionId:
      order.payment_session_id,

    amount,

    currency:
      'INR',

    mode:
      env.cashfreeMode
  };
}

async function activateMembership(
  payment,
  cfPaymentId = null
) {
  const existingMembership =
    await prisma.membership.findUnique({
      where: {
        paymentId:
          payment.id
      }
    });

  if (existingMembership) {
    if (
      payment.status !== 'PAID'
    ) {
      return prisma.payment.update({
        where: {
          id: payment.id
        },

        data: {
          status:
            'PAID',

          cfPaymentId:
            cfPaymentId ||
            payment.cfPaymentId,

          paidAt:
            payment.paidAt ||
            new Date()
        }
      });
    }

    return payment;
  }

  const plan =
    await prisma.membershipPlan.findUnique({
      where: {
        id: payment.planId
      }
    });

  if (!plan) {
    throw new AppError(
      409,
      'Membership plan no longer exists.'
    );
  }

  const now =
    new Date();

  const current =
    await prisma.membership.findFirst({
      where: {
        memberId:
          payment.memberId,

        status:
          'ACTIVE',

        startDate: {
          lte: now
        },

        endDate: {
          gt: now
        }
      },

      include: {
        plan: true
      },

      orderBy: {
        endDate: 'desc'
      }
    });

  // Recheck the purchase rule during payment verification too.
  // This protects against duplicate / stale payment attempts.
  if (current) {
    const samePlan =
      current.plan.kind ===
      plan.kind;

    const isUpgrade =
      current.plan.kind === 'AI' &&
      plan.kind === 'PERSONAL';

    if (
      samePlan &&
      payment.status !== 'PAID'
    ) {
      throw new AppError(
        409,
        `${current.plan.name} is already active.`
      );
    }

    if (
      !samePlan &&
      !isUpgrade &&
      payment.status !== 'PAID'
    ) {
      throw new AppError(
        409,
        'Your current membership must end before switching to this plan.'
      );
    }
  }

  const isImmediateUpgrade =
    Boolean(
      current &&
      current.plan.kind === 'AI' &&
      plan.kind === 'PERSONAL'
    );

  const startDate =
    isImmediateUpgrade
      ? now
      : now;

  const endDate =
    new Date(
      startDate.getTime() +
      plan.durationDays *
        24 *
        60 *
        60 *
        1000
    );

  const result =
    await prisma.$transaction(
      async tx => {
        if (
          isImmediateUpgrade &&
          current
        ) {
          await tx.membership.update({
            where: {
              id: current.id
            },

            data: {
              status:
                'CANCELLED',

              endDate:
                now
            }
          });
        }

        const membership =
          await tx.membership.upsert({
            where: {
              paymentId:
                payment.id
            },

            update: {},

            create: {
              memberId:
                payment.memberId,

              planId:
                plan.id,

              paymentId:
                payment.id,

              startDate,

              endDate,

              status:
                'ACTIVE',

              amountPaid:
                payment.amount
            }
          });

        const updatedPayment =
          await tx.payment.update({
            where: {
              id:
                payment.id
            },

            data: {
              status:
                'PAID',

              cfPaymentId:
                cfPaymentId ||
                payment.cfPaymentId,

              paidAt:
                payment.paidAt ||
                now
            }
          });

        const member =
          await tx.member.findUnique({
            where: {
              id:
                payment.memberId
            }
          });

        if (member) {
          await tx.notification.create({
            data: {
              userId:
                member.userId,

              type:
                'PAYMENT',

              title:
                isImmediateUpgrade
                  ? 'Membership upgraded'
                  : 'Membership activated',

              body:
                isImmediateUpgrade
                  ? `Your membership has been upgraded to ${plan.name}.`
                  : `${plan.name} is now active.`
            }
          });
        }

        return {
          membership,
          payment:
            updatedPayment
        };
      }
    );

  publishEvent(
    'membership-updated',
    {
      memberId:
        payment.memberId,

      planKind:
        plan.kind
    }
  );

  if (
    plan.kind === 'AI'
  ) {
    const profile =
      await prisma.aIProfile.findUnique({
        where: {
          memberId:
            payment.memberId
        }
      });

    if (profile) {
      await generateAIWeek(
        payment.memberId
      ).catch(() => null);
    }
  }

  return result.payment;
}

export async function verifyOrderForUser(
  userId,
  orderId
) {
  const memberId =
    await getMemberId(userId);

  const payment =
    await prisma.payment.findFirst({
      where: {
        orderId,
        memberId
      }
    });

  if (!payment) {
    throw new AppError(
      404,
      'Payment order not found.'
    );
  }

  if (
    payment.status === 'PAID'
  ) {
    return payment;
  }

  const transactions =
    await cashfree(
      `/orders/${encodeURIComponent(
        orderId
      )}/payments`,
      {
        method: 'GET'
      }
    );

  const success =
    Array.isArray(transactions)
      ? transactions.find(
          t =>
            t.payment_status ===
            'SUCCESS'
        )
      : null;

  const pending =
    Array.isArray(transactions)
      ? transactions.some(
          t =>
            t.payment_status ===
            'PENDING'
        )
      : false;

  if (success) {
    const updated =
      await activateMembership(
        payment,
        String(
          success.cf_payment_id ||
          ''
        )
      );

    await writeAudit({
      actorUserId:
        userId,

      action:
        'PAYMENT_VERIFIED',

      entity:
        'Payment',

      entityId:
        payment.id,

      metadata: {
        orderId
      }
    });

    return updated;
  }

  const status =
    pending
      ? 'PENDING'
      : 'FAILED';

  return prisma.payment.update({
    where: {
      id:
        payment.id
    },

    data: {
      status
    }
  });
}

export function verifyWebhookSignature(
  rawBody,
  signature,
  timestamp
) {
  if (!configured()) {
    return false;
  }

  if (
    !rawBody ||
    !signature ||
    !timestamp
  ) {
    return false;
  }

  const expected =
    crypto
      .createHmac(
        'sha256',
        env.cashfreeSecretKey
      )
      .update(
        String(timestamp) +
        rawBody
      )
      .digest('base64');

  const a =
    Buffer.from(expected);

  const b =
    Buffer.from(
      String(signature)
    );

  return (
    a.length === b.length &&
    crypto.timingSafeEqual(
      a,
      b
    )
  );
}

export async function processWebhook(
  rawBody,
  headers
) {
  const signature =
    headers[
      'x-webhook-signature'
    ];

  const timestamp =
    headers[
      'x-webhook-timestamp'
    ];

  if (
    !verifyWebhookSignature(
      rawBody,
      signature,
      timestamp
    )
  ) {
    throw new AppError(
      401,
      'Invalid webhook signature.'
    );
  }

  const event =
    JSON.parse(rawBody);

  const orderId =
    event?.data?.order
      ?.order_id;

  const paymentStatus =
    event?.data?.payment
      ?.payment_status;

  const cfPaymentId =
    event?.data?.payment
      ?.cf_payment_id;

  if (!orderId) {
    return {
      ignored: true
    };
  }

  const payment =
    await prisma.payment.findUnique({
      where: {
        orderId
      }
    });

  if (!payment) {
    return {
      ignored: true
    };
  }

  if (
    paymentStatus ===
    'SUCCESS'
  ) {
    await activateMembership(
      payment,
      cfPaymentId
        ? String(cfPaymentId)
        : null
    );

    return {
      ok: true,
      status: 'PAID'
    };
  }

  if (
    payment.status !== 'PAID' &&
    [
      'FAILED',
      'USER_DROPPED'
    ].includes(paymentStatus)
  ) {
    await prisma.payment.update({
      where: {
        id:
          payment.id
      },

      data: {
        status:
          'FAILED'
      }
    });
  }

  return {
    ok: true,
    status:
      paymentStatus ||
      'IGNORED'
  };
}