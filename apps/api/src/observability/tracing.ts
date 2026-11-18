import { trace, type Attributes } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import type { RequestHandler } from 'express';
import { redactSensitive } from '../common/redact';
import { validateEnv, type Env } from '../config/env';

let sdk: NodeSDK | undefined;

export function startTracing(env: Env): void {
  if (!env.OTEL_ENABLED) {
    return;
  }
  sdk = new NodeSDK({
    resource: resourceFromAttributes({ [ATTR_SERVICE_NAME]: env.OTEL_SERVICE_NAME }),
    traceExporter: new OTLPTraceExporter({ url: env.OTEL_EXPORTER_OTLP_ENDPOINT }),
    instrumentations: [],
  });
  sdk.start();
}

export async function stopTracing(): Promise<void> {
  if (!sdk) {
    return;
  }
  await sdk.shutdown();
  sdk = undefined;
}

export function safeSpanAttributes(attributes: Record<string, string | number | boolean>): Attributes {
  return redactSensitive(attributes) as Attributes;
}

export function traceRoute(name: string, path: string): RequestHandler {
  const tracer = trace.getTracer(validateEnv().OTEL_SERVICE_NAME);
  return (req, res, next) => {
    const span = tracer.startSpan(`http ${name}`, {
      attributes: safeSpanAttributes({
        'http.method': req.method,
        'http.route': path,
        'aegis.route': name,
      }),
    });
    let ended = false;
    const finish = (): void => {
      if (ended) {
        return;
      }
      ended = true;
      span.setAttribute('http.status_code', res.statusCode);
      span.end();
    };
    res.once('finish', finish);
    res.once('close', finish);
    next();
  };
}
