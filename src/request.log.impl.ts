import type { ZLogMessage, ZLogRecorder } from '@run-z/log-z';
import { ZLogLevel } from '@run-z/log-z';
import type { RequestZLogConfig } from './logging';

/**
 * @internal
 */
export function logZRequest(config: RequestZLogConfig, by: ZLogRecorder): ZLogRecorder {

  const { immediate = ZLogLevel.Error } = config;
  const recorded: ZLogMessage[] = [];

  const recordNow = (message: ZLogMessage): void => {
    if ('immediate' in message.details) {
      // Remove `immediate` flag from details

      const details = { ...message.details };

      delete details.immediate;

      by.record({ ...message, details });
    } else {
      by.record(message);
    }
  };

  let whenLogged = (_which?: ('all' | 'last')): Promise<boolean> => Promise.resolve(true);
  let record = (message: ZLogMessage): void => {
    if (message.level >= immediate || message.details.immediate) {
      record = recordNow;
      recorded.forEach(m => by.record(m));
      recorded.length = 0;
      recordNow(message);
      whenLogged = by.whenLogged.bind(by);
    } else {
      recorded.push(message);
    }
  };
  let end = (): Promise<void> => {
    recorded.length = 0;
    record = by.record.bind(by);
    whenLogged = by.whenLogged.bind(by);
    end = () => by.end();
    return end();
  };

  return {

    record(message) {
      record(message);
    },

    whenLogged(which) {
      return whenLogged(which);
    },

    end() {
      return end();
    },

  };
}
