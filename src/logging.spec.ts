import type { RequestContext, RequestProcessor } from '@hatsy/hatsy/core';
import { LoggerMeans, RequestHandler, requestProcessor } from '@hatsy/hatsy/core';
import { asis, newPromiseResolver, noop, valueProvider } from '@proc7ts/primitives';
import type { ZLogger, ZLogRecorder } from '@run-z/log-z';
import { zlogDetails, zlogINFO, ZLogLevel } from '@run-z/log-z';
import type { RequestZLogConfig } from './logging';
import { ZLogging } from './logging';

describe('ZLogging', () => {

  let infoSpy: jest.SpyInstance;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    infoSpy = jest.spyOn(console, 'info').mockImplementation(noop);
    errorSpy = jest.spyOn(console, 'error').mockImplementation(noop);
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

    const promise = processor(handler)({});

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
      const logError = jest.fn();

      expect(await processor(handler, { logError })({}).catch(asis)).toBe(error);
      expect(logError).toHaveBeenCalledWith(expect.objectContaining({ error }));
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('by', () => {
    it('logs errors', async () => {

      const by: jest.Mocked<ZLogRecorder> = {
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

      const by: jest.Mocked<ZLogRecorder> = {
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
      async next<TExt>(handler: RequestHandler<TExt>, context: RequestContext<TExt>): Promise<boolean> {
        await handler(context);
        return true;
      },
    });
  }

});
