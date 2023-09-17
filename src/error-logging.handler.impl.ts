import type { ErrorMeans, LoggerMeans, RequestContext, RequestHandler } from '@hatsy/hatsy/core.js';
import { requestExtension } from '@hatsy/hatsy/core.js';
import type { ZLogger } from '@run-z/log-z';
import { zlogDetails } from '@run-z/log-z';
import type { RequestZLogConfig } from './logging.js';

/**
 * @internal
 */
export function errorLoggingHandler<TInput>(
  config: RequestZLogConfig<TInput>,
  handler: RequestHandler<TInput & LoggerMeans<ZLogger>>,
): RequestHandler<TInput & LoggerMeans<ZLogger>> {
  const logError: RequestHandler<TInput & LoggerMeans<ZLogger> & ErrorMeans> = config.logError
    ? config.logError.bind(config)
    : logImmediately;

  return (context: RequestContext<TInput & LoggerMeans<ZLogger>>) => context.next(handler).catch(async error => {
      await context.next(
        logError,
        requestExtension<TInput & LoggerMeans<ZLogger>, ErrorMeans>({ error }),
      );

      return Promise.reject(error);
    });
}

/**
 * @internal
 */
function logImmediately({ error, log }: RequestContext<LoggerMeans<ZLogger> & ErrorMeans>): void {
  log.error(zlogDetails({ error, immediate: true }));
}
