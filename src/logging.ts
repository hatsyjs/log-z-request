import type { ErrorMeans, LoggerMeans, RequestContext, RequestHandler } from '@hatsy/hatsy/core';
import { RequestCapability, requestExtension } from '@hatsy/hatsy/core';
import type { ZLogger, ZLogLevel, ZLogRecorder } from '@run-z/log-z';
import { logZ, logZAtopOf, logZBy } from '@run-z/log-z';
import { errorLoggingHandler } from './error-logging.handler.impl';
import { logZRequest } from './request.log.impl';

/**
 * Logger configuration.
 *
 * @typeParam TInput - A type of incoming request processing means.
 */
export interface RequestZLogConfig<TInput = unknown> {

  /**
   * A log level causing immediate logging.
   *
   * Once a message with this level is logged, then all messages logged during the same request processing are
   * recorded to the log. Both logged before and after.
   *
   * @default Error level.
   */
  readonly immediate?: ZLogLevel | undefined;

  /**
   * A log recorded to log messages by.
   *
   * @default Console log recorder.
   */
  readonly by?: ZLogRecorder | undefined;

  /**
   * Builds a logger for the request.
   *
   * This method is called for each request. The log recorder returned by it is used to build a request logger
   * available via `LoggerMeans`.
   *
   * The logging is ended after request completion.
   *
   * @param logger - Global log recorder.
   * @param context - Request processing context to build the logger for.
   *
   * @returns A log recorder to use to log request processing messages.
   */
  forRequest?(logger: ZLogRecorder, context: RequestContext<TInput>): ZLogRecorder;

  /**
   * Logs an error occurred during error processing.
   *
   * Logs the error as an `error` detail.
   *
   * @param context - Error processing context with logger means.
   *
   * @returns Either nothing if error logged synchronously, or a promise-like instance resolved when error logged
   * asynchronously.
   */
  logError?(context: RequestContext<TInput & LoggerMeans<ZLogger> & ErrorMeans>): void | PromiseLike<unknown>;

}

/**
 * Request logging capability via [@run-z/log-z](https://www.npmjs.com/package/@run-z/log-z).
 *
 * Provides request logger means containing `ZLogger` instance for handlers.
 *
 * The log messages are actually written to the log under certain conditions. E.g. when request processing error
 * occurred, error logged, or immediate logging triggered explicitly. Once immediate logging triggered, all log
 * messages for the log are recorded to the log, as well as all messages logged after that.
 *
 * To trigger immediate logging add `immediate` property with truthy value to log message details like this:
 * ```typescript
 * context.log.info('Immediate message', zlogDetails({ immediate: true }));
 * ```
 *
 * @typeParam TInput - A type of request processing means required in order to apply this capability.
 */
export interface ZLogging<TInput = unknown> extends RequestCapability<TInput, LoggerMeans<ZLogger>> {

  /**
   * Configures request logging.
   *
   * @param config - New request logging configuration.
   *
   * @returns A logging capability with the given configuration applied.
   */
  with<TNewInput>(config?: RequestZLogConfig<TNewInput>): ZLogging<TNewInput>;

}

/**
 * @internal
 */
class ZLoggingCapability<TInput>
    extends RequestCapability<TInput, LoggerMeans<ZLogger>>
    implements ZLogging<TInput> {

  readonly for: <TMeans extends TInput>(
      handler: RequestHandler<TMeans & LoggerMeans<ZLogger>>,
  ) => RequestHandler<TMeans>;

  constructor(config: RequestZLogConfig<TInput>) {
    super();

    const globalLogger = config.by ? logZBy(config.by) : logZ({ atLeast: 0 });
    const forRequest = config.forRequest ? config.forRequest.bind(config) : logZAtopOf;

    this.for = <TMeans extends TInput>(
        handler: RequestHandler<TMeans & LoggerMeans<ZLogger>>,
    ): RequestHandler<TMeans> => async context => {

      const log = logZBy(
          logZRequest(
              config,
              forRequest(
                  globalLogger,
                  context as RequestContext<TInput>,
              ),
          ),
      );

      try {
        await context.next(
            errorLoggingHandler(config as RequestZLogConfig<TMeans>, handler),
            requestExtension<TMeans, LoggerMeans<ZLogger>>({ log }),
        );
      } finally {
        await log.end();
      }
    };
  }

  with<TNewInput>(config: RequestZLogConfig<TNewInput> = {}): ZLogging<TNewInput> {
    return new ZLoggingCapability(config);
  }

}

/**
 * Default request logging capability.
 *
 * Logs messages to console.
 *
 * Triggers immediate logging on error.
 */
export const ZLogging: ZLogging = (/*#__PURE__*/ new ZLoggingCapability({}));
