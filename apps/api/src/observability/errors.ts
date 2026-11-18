import * as Sentry from '@sentry/node';
import { redactSensitive, redactStrings, redactText } from '../common/redact';
import { validateEnv, type Env } from '../config/env';
import { stopTracing } from './tracing';

type EventRecord = Record<string, any>;

function redactExceptionValues(values: unknown[] | undefined): unknown[] | undefined {
  return values?.map((value) => {
    const redacted = redactStrings(value);
    if (!redacted || typeof redacted !== 'object') {
      return redacted;
    }
    const item = redacted as EventRecord;
    if (item.mechanism && typeof item.mechanism === 'object') {
      item.mechanism = redactStrings(redactSensitive(item.mechanism));
    }
    return item;
  });
}

function redactBreadcrumbValues(values: unknown[] | undefined): unknown[] | undefined {
  return values?.map((value) => redactStrings(redactSensitive(value)));
}

export function redactEvent<T>(event: T): T {
  const source = event as EventRecord;
  const target = redactStrings(source) as EventRecord;

  for (const key of ['extra', 'contexts', 'tags', 'user']) {
    if (source[key]) {
      target[key] = redactStrings(redactSensitive(source[key]));
    }
  }
  if (source.request) {
    const request = source.request as EventRecord;
    target.request = {
      ...redactStrings(redactSensitive(request)),
      url: request.url ? redactText(request.url) : request.url,
      query_string: request.query_string ? redactText(request.query_string) : request.query_string,
    };
  }
  if (source.breadcrumbs) {
    const breadcrumbs = source.breadcrumbs as EventRecord;
    target.breadcrumbs = {
      ...redactStrings(breadcrumbs),
      values: redactBreadcrumbValues(breadcrumbs.values),
    };
  }
  if (source.exception) {
    const exception = source.exception as EventRecord;
    target.exception = {
      ...redactStrings(exception),
      values: redactExceptionValues(exception.values),
    };
  }

  return target as T;
}

export function startErrorMonitoring(env: Env): void {
  if (!env.SENTRY_DSN) {
    return;
  }
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.RELEASE,
    tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE,
    beforeSend(event) {
      return redactEvent(event);
    },
    beforeSendTransaction(event) {
      return redactEvent(event);
    },
  });
}

export function captureException(error: unknown, context: Record<string, unknown> = {}): void {
  if (!validateEnv().SENTRY_DSN) {
    return;
  }
  Sentry.captureException(error, {
    contexts: {
      aegis: redactStrings(redactSensitive(context)),
    },
  });
}

export async function flushObservability(): Promise<void> {
  await Promise.all([Sentry.flush(2000), stopTracing()]);
}
