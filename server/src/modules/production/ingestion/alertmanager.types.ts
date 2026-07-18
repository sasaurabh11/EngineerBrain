/** Real Alertmanager webhook payload shape
 * (https://prometheus.io/docs/alerting/latest/configuration/#webhook_config). */
export interface AlertmanagerAlert {
  status: "firing" | "resolved";
  labels: Record<string, string>;
  annotations: Record<string, string>;
  startsAt: string;
  endsAt: string;
  fingerprint: string;
  generatorURL?: string;
}

export interface AlertmanagerPayload {
  version: string;
  groupKey: string;
  status: "firing" | "resolved";
  receiver: string;
  alerts: AlertmanagerAlert[];
}
