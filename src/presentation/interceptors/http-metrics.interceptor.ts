import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { MetricsService } from '@infrastructure/observability/metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }
    const http = context.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();
    const stop = this.metrics.httpDuration.startTimer();

    // 'finish' also fires for requests rejected by exception filters, so
    // errors are counted with their real status code.
    res.once('finish', () => {
      const labels = {
        method: req.method,
        // Route template, never the raw URL: keeps label cardinality bounded.
        route: req.route?.path ?? 'unmatched',
        status_code: String(res.statusCode),
      };
      stop(labels);
      this.metrics.httpRequests.inc(labels);
    });
    return next.handle();
  }
}
