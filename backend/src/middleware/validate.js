import { ZodError } from 'zod';

/**
 * Supports all of these validation formats:
 *
 * 1. Container object:
 * validate({
 *   params: z.object({ ... }),
 *   body: z.object({ ... }),
 *   query: z.object({ ... }),
 * })
 *
 * 2. Wrapped Zod object:
 * validate(
 *   z.object({
 *     body: z.object({ ... }),
 *     params: z.object({ ... }),
 *   }),
 * )
 *
 * 3. Direct body schema:
 * validate(
 *   z.object({
 *     email: z.string().email(),
 *     password: z.string(),
 *   }),
 * )
 */
export const validate = (schema) => {
  return async (req, res, next) => {
    try {
      if (!schema) {
        return res.status(500).json({
          success: false,
          message: 'Validation schema is missing.',
        });
      }

      /*
       * Format 1:
       * {
       *   params: z.object(...),
       *   body: z.object(...),
       *   query: z.object(...)
       * }
       */
      if (
        typeof schema === 'object' &&
        typeof schema.safeParseAsync !== 'function'
      ) {
        if (schema.params) {
          const paramsResult =
            await schema.params.safeParseAsync(req.params);

          if (!paramsResult.success) {
            return sendValidationError(
              res,
              paramsResult.error,
              'params',
            );
          }

          req.params = paramsResult.data;
        }

        if (schema.query) {
          const queryResult =
            await schema.query.safeParseAsync(req.query);

          if (!queryResult.success) {
            return sendValidationError(
              res,
              queryResult.error,
              'query',
            );
          }

          /*
           * Express query objects can be getter-backed.
           * Mutating the existing object is safer than assigning req.query.
           */
          Object.keys(req.query).forEach((key) => {
            delete req.query[key];
          });

          Object.assign(req.query, queryResult.data);
        }

        if (schema.body) {
          const bodyResult =
            await schema.body.safeParseAsync(req.body);

          if (!bodyResult.success) {
            return sendValidationError(
              res,
              bodyResult.error,
              'body',
            );
          }

          req.body = bodyResult.data;
        }

        return next();
      }

      /*
       * Formats 2 and 3:
       * A direct Zod schema.
       */
      if (typeof schema.safeParseAsync === 'function') {
        const requestPayload = {
          body: req.body || {},
          params: req.params || {},
          query: req.query || {},
        };

        /*
         * First try a wrapped request schema:
         *
         * z.object({
         *   body: z.object(...),
         *   params: z.object(...),
         * })
         */
        const wrappedResult =
          await schema.safeParseAsync(requestPayload);

        if (wrappedResult.success) {
          if (wrappedResult.data.body !== undefined) {
            req.body = wrappedResult.data.body;
          }

          if (wrappedResult.data.params !== undefined) {
            req.params = wrappedResult.data.params;
          }

          if (wrappedResult.data.query !== undefined) {
            Object.keys(req.query).forEach((key) => {
              delete req.query[key];
            });

            Object.assign(
              req.query,
              wrappedResult.data.query,
            );
          }

          return next();
        }

        /*
         * If the wrapped request failed, try it as a direct body schema:
         *
         * z.object({
         *   email: z.string(),
         *   password: z.string(),
         * })
         */
        const bodyResult =
          await schema.safeParseAsync(req.body);

        if (bodyResult.success) {
          req.body = bodyResult.data;
          return next();
        }

        /*
         * Prefer the direct-body error when it contains meaningful fields.
         * Otherwise return the wrapped-schema error.
         */
        const bodyHasUsefulIssues =
          bodyResult.error?.issues?.some(
            (issue) => issue.path.length > 0,
          );

        return sendValidationError(
          res,
          bodyHasUsefulIssues
            ? bodyResult.error
            : wrappedResult.error,
        );
      }

      return res.status(500).json({
        success: false,
        message: 'Invalid validation schema configuration.',
      });
    } catch (error) {
      if (error instanceof ZodError) {
        return sendValidationError(res, error);
      }

      console.error('Validation middleware error:', error);

      return res.status(500).json({
        success: false,
        message:
          'Validation failed due to an internal server error.',
      });
    }
  };
};

function sendValidationError(
  res,
  error,
  defaultSection = '',
) {
  const issues = Array.isArray(error?.issues)
    ? error.issues
    : [];

  const errors = issues.map((issue) => {
    const issuePath = issue.path || [];

    const fieldPath = [
      defaultSection,
      ...issuePath.map(String),
    ]
      .filter(Boolean)
      .join('.');

    return {
      field: fieldPath,
      message: issue.message || 'Invalid value',
      code: issue.code || 'validation_error',
    };
  });

  return res.status(400).json({
    success: false,
    message:
      errors[0]?.message || 'Validation failed.',
    errors,
  });
}