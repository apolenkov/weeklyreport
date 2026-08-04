import * as Sentry from "@sentry/nextjs";

import { createSentryInitOptions } from "./sentry-options.config";

Sentry.init(createSentryInitOptions());
