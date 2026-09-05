export interface MetricsSummary {
  uptimeSeconds: number;
  totalRequests: number;
  totalErrors: number;
  requestsByStatus: Record<string, number>;
  requestsByRoute: Record<string, number>;
  agentRuns: Record<string, { total: number; successful: number; failed: number }>;
  averageLatencyMs: number;
}

class MetricsCollector {
  private startTime = Date.now();
  private totalRequests = 0;
  private totalErrors = 0;
  private totalLatencyMs = 0;
  private requestsByStatus = new Map<number, number>();
  private requestsByRoute = new Map<string, number>();
  private agentRuns = new Map<string, { total: number; successful: number; failed: number }>();

  public recordRequest(route: string, statusCode: number, durationMs: number): void {
    this.totalRequests++;
    this.totalLatencyMs += durationMs;

    if (statusCode >= 400) {
      this.totalErrors++;
    }

    const currentStatusCount = this.requestsByStatus.get(statusCode) || 0;
    this.requestsByStatus.set(statusCode, currentStatusCount + 1);

    const currentRouteCount = this.requestsByRoute.get(route) || 0;
    this.requestsByRoute.set(route, currentRouteCount + 1);
  }

  public recordAgentRun(agentId: string, success: boolean): void {
    const existing = this.agentRuns.get(agentId) || { total: 0, successful: 0, failed: 0 };
    existing.total++;
    if (success) {
      existing.successful++;
    } else {
      existing.failed++;
    }
    this.agentRuns.set(agentId, existing);
  }

  public getSummary(): MetricsSummary {
    const uptimeSeconds = Math.floor((Date.now() - this.startTime) / 1000);
    const averageLatencyMs = this.totalRequests > 0 ? Math.round(this.totalLatencyMs / this.totalRequests) : 0;

    const statusObj: Record<string, number> = {};
    for (const [code, count] of this.requestsByStatus.entries()) {
      statusObj[String(code)] = count;
    }

    const routeObj: Record<string, number> = {};
    for (const [route, count] of this.requestsByRoute.entries()) {
      routeObj[route] = count;
    }

    const agentsObj: Record<string, { total: number; successful: number; failed: number }> = {};
    for (const [agent, stat] of this.agentRuns.entries()) {
      agentsObj[agent] = { ...stat };
    }

    return {
      uptimeSeconds,
      totalRequests: this.totalRequests,
      totalErrors: this.totalErrors,
      requestsByStatus: statusObj,
      requestsByRoute: routeObj,
      agentRuns: agentsObj,
      averageLatencyMs,
    };
  }

  public reset(): void {
    this.startTime = Date.now();
    this.totalRequests = 0;
    this.totalErrors = 0;
    this.totalLatencyMs = 0;
    this.requestsByStatus.clear();
    this.requestsByRoute.clear();
    this.agentRuns.clear();
  }
}

export const metrics = new MetricsCollector();
