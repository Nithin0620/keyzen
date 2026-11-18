import type { RequestHandler } from 'express';
import type { BillingCheckoutInput } from '@aegis/shared';
import { billingCheckoutSchema, workspaceIdParamSchema } from '@aegis/shared';
import type { AuthenticatedRequest } from '../auth/jwt-auth.guard';
import { auditedRoute, defineRoute } from '../authz/route-manifest';
import { BadRequestException } from '../common/http-error';
import { validate } from '../common/zod-validation.pipe';
import type { ManagedRoute } from '../http/router';
import type { BillingService } from './billing.service';

interface BillingRouteDependencies {
  billing: BillingService;
}

export function createBillingRoutes(deps: BillingRouteDependencies): ManagedRoute[] {
  const user = (req: Parameters<RequestHandler>[0]): AuthenticatedRequest['user'] =>
    (req as AuthenticatedRequest).user;

  const get: RequestHandler = async (req, res) => {
    res.json(await deps.billing.get(req.params.workspaceId));
  };

  const checkout: RequestHandler = async (req, res) => {
    const actor = user(req);
    res.status(201).json(
      await deps.billing.createCheckout(
        actor.sub,
        req.params.workspaceId,
        (req.body as BillingCheckoutInput).plan,
        actor.email
      )
    );
  };

  const webhook: RequestHandler = async (req, res) => {
    if (!Buffer.isBuffer(req.body)) {
      throw new BadRequestException('Invalid webhook body');
    }
    await deps.billing.handleWebhook(req.body, req.get('stripe-signature') ?? undefined);
    res.json({ received: true });
  };

  return [
    auditedRoute({ name: 'billing.get', method: 'get', path: '/workspaces/:workspaceId/billing', permission: 'billing.manage', middlewares: [validate(workspaceIdParamSchema, 'params')], handler: get }),
    auditedRoute({ name: 'billing.checkout', method: 'post', path: '/workspaces/:workspaceId/billing/checkout', permission: 'billing.manage', middlewares: [validate(workspaceIdParamSchema, 'params'), validate(billingCheckoutSchema)], handler: checkout }),
    defineRoute({ name: 'billing.webhook', method: 'post', path: '/billing/webhook', public: true, handler: webhook }),
  ];
}
