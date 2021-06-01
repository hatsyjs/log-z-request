Log That Request
================

[![NPM][npm-image]][npm-url]
[![Build Status][build-status-img]][build-status-link]
[![Code Quality][quality-img]][quality-link]
[![Coverage][coverage-img]][coverage-link]
[![GitHub Project][github-image]][github-url]
[![API Documentation][api-docs-image]][API documentation]

Request logging by [@run-z/log-z] logger.

Contains a `ZLogging` capability that provides a request logger means containing `ZLogger` instance for handlers.

The log messages are actually written to the log under certain conditions. E.g. when request processing error
occurred, error logged, or immediate logging triggered explicitly. Once immediate logging triggered, all log
messages for the log are recorded to the log, as well as all messages logged after that.

To trigger immediate logging add `immediate` property with truthy value to log message details like this:
```typescript
context.log.info('Immediate message', zlogDetails({ immediate: true }));
```

[npm-image]: https://img.shields.io/npm/v/@hatsy/log-z-request.svg?logo=npm
[npm-url]: https://www.npmjs.com/package/@hatsy/log-z-request
[build-status-img]: https://github.com/hatsyjs/log-z-request/workflows/Build/badge.svg
[build-status-link]: https://github.com/hatsyjs/log-z-request/actions?query=workflow:Build
[quality-img]: https://app.codacy.com/project/badge/Grade/92ac3a82e01347aaa57cb858a3e0811c
[quality-link]: https://www.codacy.com/gh/hatsyjs/log-z-request/dashboard?utm_source=github.com&utm_medium=referral&utm_content=hatsyjs/log-z-request&utm_campaign=Badge_Grade
[coverage-img]: https://app.codacy.com/project/badge/Coverage/92ac3a82e01347aaa57cb858a3e0811c
[coverage-link]: https://www.codacy.com/gh/hatsyjs/log-z-request/dashboard?utm_source=github.com&utm_medium=referral&utm_content=hatsyjs/log-z-request&utm_campaign=Badge_Coverage
[github-image]: https://img.shields.io/static/v1?logo=github&label=GitHub&message=project&color=informational
[github-url]: https://github.com/hatsyjs/log-z-request
[api-docs-image]: https://img.shields.io/static/v1?logo=typescript&label=API&message=docs&color=informational
[API documentation]: https://hatsyjs.github.io/log-z-request

[@run-z/log-z]: https://www.npmjs.com/package/@run-z/log-z


Example Setup
-------------

```typescript
import { httpListener } from '@hatsy/hatsy';
import { ZLogging } from '@hatsy/log-z-request';
import { Rendering } from '@hatsy/router';
import { logZAtopOf, logZTimestamp, logZWithDetails, zlogDetails } from '@run-z/log-z';
import { logZToStream } from '@run-z/log-z/node';
import { createServer } from 'http';

const server = createServer(httpListener(
    {

      handleBy(handler) {
        // Set up logging before request processing.
        return ZLogging.with({

          by: logZTimestamp(                // Log timestamp.
              logZToStream(process.stdout), // Log to standard output.
          ),

          forRequest(logger, { request: { method, url } }) {
            return logZWithDetails(
                {
                  method,                   // Add request method to log message details.
                  url,                      // Add request URL to log message details. 
                },
                logZAtopOf(logger),         // Create child logger per request.
            );
          },

        }).for(handler);
      },

    },
    Rendering.for(({ log, renderJson }) => {
      // Log immeditely instead of when error occurrred.
      log.info('Hello!', zlogDetails({ immediate: true }));
      renderJson({ hello: 'World!' });      
    }),
));
```
