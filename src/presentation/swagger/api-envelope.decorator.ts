import { Type, applyDecorators } from '@nestjs/common';
import { ApiExtraModels, ApiResponse, getSchemaPath } from '@nestjs/swagger';

// TransformInterceptor wraps every successful body as { status, data }, so the
// documented response must show the envelope, not just the DTO.
export const ApiEnvelopeResponse = <T extends Type<unknown>>(
  model: T,
  status = 200,
  description?: string,
) =>
  applyDecorators(
    ApiExtraModels(model),
    ApiResponse({
      status,
      description,
      schema: {
        type: 'object',
        properties: {
          status: { type: 'number', example: status },
          data: { $ref: getSchemaPath(model) },
        },
      },
    }),
  );
