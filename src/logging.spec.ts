import type { RequestContext, RequestProcessor } from '@hatsy/hatsy/core';
import { LoggerMeans, RequestHandler, requestProcessor } from '@hatsy/hatsy/core';
import { afterEach, beforeEach, describe, expect, it, jest } from '@jest/globals';
import { consoleLogger, processingLogger } from '@proc7ts/logger';
import { asis, newPromiseResolver, noop, valueProvider } from '@proc7ts/primitives';
import type { ZLogger, ZLogRecorder } from '@run-z/log-z';
import { logZToLogger, zlogDetails, zlogINFO, ZLogLevel } from '@run-z/log-z';
import type { Mock } from 'jest-mock';
import type { RequestZLogConfig } from './logging';
import { ZLogging } from './logging';

describe('ZLogging', () => {
  let infoSpy: Mock<(...args: unknown[]) => void>;
  let errorSpy: Mock<(...args: unknown[]) => void>;

  beforeEach(() => {
    infoSpy = jest.spyOn(consoleLogger, 'info').mockImplementation(noop) as typeof infoSpy;
    errorSpy = jest.spyOn(consoleLogger, 'error').mockImplementation(noop) as typeof errorSpy;
  });
  afterEach(() => {
    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });

  it('logs nothing until error logged', async () => {
    const whenLogged1 = newPromiseResolver<boolean>();
    const whenLogged2 = newPromiseResolver<boolean>();
    const handler: RequestHandler<LoggerMeans<ZLogger>> = async ({ log }) => {
      log.info('Info');
      whenLogged1.resolve(log.whenLogged());
      await whenLogged2.promise();
      log.error('Error');
      await log.whenLogged();
    };

    const promise = processor(handler)({});

    await whenLogged1.promise();

    expect(infoSpy).not.toHaveBeenCalled();

    whenLogged2.resolve(true);
    await promise;

    expect(infoSpy).toHaveBeenCalledWith('Info');
    expect(errorSpy).toHaveBeenCalledWith('Error');
  });
  it('allows to trigger immediate logging', async () => {
    const whenLogged1 = newPromiseResolver<boolean>();
    const whenLogged2 = newPromiseResolver<boolean>();
    const handler: RequestHandler<LoggerMeans<ZLogger>> = async ({ log }) => {
      log.info('Deferred');
      whenLogged1.resolve(log.whenLogged());
      await whenLogged2.promise();
      log.info('Immediate', zlogDetails({ immediate: true }));
      await log.whenLogged();
    };

    const promise = processor(handler)({});

    await whenLogged1.promise();

    expect(infoSpy).not.toHaveBeenCalled();

    whenLogged2.resolve(true);
    await promise;

    expect(infoSpy).toHaveBeenCalledWith('Deferred');
    expect(infoSpy).toHaveBeenCalledWith('Immediate');
  });
  it('triggers immediate logging on error', async () => {
    const whenLogged = newPromiseResolver<boolean>();
    const whenError = newPromiseResolver();
    const handler: RequestHandler<LoggerMeans<ZLogger>> = async ({ log }) => {
      log.info('Deferred');
      whenLogged.resolve(log.whenLogged());
      await whenError.promise();
    };

    const promise = processor(handler, { by: logZToLogger(processingLogger(consoleLogger)) })({});

    await whenLogged.promise();

    expect(infoSpy).not.toHaveBeenCalled();

    const error = 'Test error';

    whenError.reject(error);
    expect(await promise.catch(asis)).toBe(error);

    expect(infoSpy).toHaveBeenCalledWith('Deferred');
    expect(errorSpy).toHaveBeenCalledWith(error);
  });

  describe('logError', () => {
    it('is called on error', async () => {
      const error = new Error('Test');
      const handler: RequestHandler<LoggerMeans<ZLogger>> = () => {
        throw error;
      };
      const logError = jest.fn<(context: RequestContext<LoggerMeans<ZLogger>>) => void>();

      expect(await processor(handler, { logError })({}).catch(asis)).toBe(error);
      expect(logError).toHaveBeenCalledWith(
        expect.objectContaining({ error }) as unknown as RequestContext<LoggerMeans<ZLogger>>,
      );
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('by', () => {
    it('logs errors', async () => {
      const by: ZLogRecorder = {
        record: jest.fn(),
        whenLogged: jest.fn(() => Promise.resolve(true)),
        end: jest.fn(() => Promise.resolve()),
      };
      const handler: RequestHandler<LoggerMeans<ZLogger>> = async ({ log }) => {
        log.info('Message');
        await log.whenLogged('all');
      };

      await processor(handler, { by, immediate: ZLogLevel.Info })({});

      expect(by.record).toHaveBeenCalledWith(zlogINFO('Message'));
      expect(by.whenLogged).toHaveBeenCalledWith('all');
      expect(by.end).not.toHaveBeenCalled();
    });
  });

  describe('end', () => {
    it('stops logging', async () => {
      const handler: RequestHandler<LoggerMeans<ZLogger>> = async ({ log }) => {
        await log.end();
        log.error('Message 1', zlogDetails({ immediate: true }));
        expect(await log.whenLogged()).toBe(false);
      };

      await processor(handler)({});

      expect(errorSpy).not.toHaveBeenCalled();
    });
    it('is called automatically upon request completion', async () => {
      const by: ZLogRecorder = {
        record: jest.fn(),
        whenLogged: jest.fn(() => Promise.resolve(true)),
        end: jest.fn(() => Promise.resolve()),
      };
      const handler: RequestHandler<LoggerMeans<ZLogger>> = async ({ log }) => {
        log.info('Message');
        await log.whenLogged('all');
      };

      await processor(handler, { immediate: ZLogLevel.Info, forRequest: valueProvider(by) })({});

      expect(by.record).toHaveBeenCalledWith(zlogINFO('Message'));
      expect(by.whenLogged).toHaveBeenCalledWith('all');
      expect(by.end).toHaveBeenCalled();
    });
  });

  function processor(
    handler: RequestHandler<LoggerMeans<ZLogger>>,
    config?: RequestZLogConfig,
  ): RequestProcessor<object> {
    return requestProcessor({
      handler: ZLogging.with(config).for(handler),
      async next<TExt>(
        handler: RequestHandler<TExt>,
        context: RequestContext<TExt>,
      ): Promise<boolean> {
        await handler(context);

        return true;
      },
    });
  }
});
