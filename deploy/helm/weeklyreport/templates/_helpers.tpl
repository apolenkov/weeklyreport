{{/* Object names are fixed (no release prefix): the web image bakes http://api:3001. */}}

{{- define "wr.labels" -}}
app.kubernetes.io/name: weeklyreport
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
{{- end }}

{{- define "wr.selector" -}}
app.kubernetes.io/name: weeklyreport
app.kubernetes.io/component: {{ .component }}
{{- end }}

{{- define "wr.image" -}}
{{ printf "%s/%s:%s" .root.Values.images.registry .name .root.Values.images.tag }}
{{- end }}

{{- define "wr.secretName" -}}
{{ default "weeklyreport-secrets" .Values.secrets.existingSecret }}
{{- end }}

{{- define "wr.secretRef" -}}
valueFrom:
  secretKeyRef:
    name: {{ include "wr.secretName" .root }}
    key: {{ .key }}
    {{- if .optional }}
    optional: true
    {{- end }}
{{- end }}

{{/* Pod fields shared by every workload: no API token, no service-link env
vars (a Service named `api` would inject API_PORT=tcp://... and crash Gotenberg), pull secret, non-root. */}}
{{- define "wr.podCommon" -}}
automountServiceAccountToken: false
enableServiceLinks: false
{{- with .root.Values.images.pullSecret }}
imagePullSecrets:
  - name: {{ . }}
{{- end }}
securityContext:
  runAsNonRoot: true
  runAsUser: {{ .user }}
  {{- with .fsGroup }}
  fsGroup: {{ . }}
  {{- end }}
  seccompProfile:
    type: RuntimeDefault
{{- end }}

{{- define "wr.containerSecurity" -}}
securityContext:
  allowPrivilegeEscalation: false
  capabilities:
    drop: ["ALL"]
    {{- with .add }}
    add: {{ toJson . }}
    {{- end }}
{{- end }}

{{/* Origin the renderer prints, and the anchored regex that admits only it. */}}
{{- define "wr.printOrigin" -}}
{{ printf "http://web.%s.svc.%s:3000" .Release.Namespace .Values.clusterDomain }}
{{- end }}

{{- define "wr.allowList" -}}
{{ printf "^%s/" (include "wr.printOrigin" . | replace "." "\\.") }}
{{- end }}

{{/* One of existingSecret or create, never both or neither; password stays URL-safe. */}}
{{- define "wr.validateSecrets" -}}
{{- $existing := ne (default "" .Values.secrets.existingSecret) "" -}}
{{- if eq $existing (default false .Values.secrets.create) -}}
{{- fail "secrets: set exactly one of secrets.existingSecret or secrets.create=true" -}}
{{- end -}}
{{- if .Values.secrets.create -}}
{{- $v := default dict .Values.secrets.values -}}
{{- range $key := list "DB_PASSWORD" "AUTH_JWT_SECRET" "PDF_EXPORT_JWT_SECRET" "AI_PROVIDER_CONFIG_ENCRYPTION_KEY" -}}
{{- if not (hasKey $v $key) -}}
{{- fail (printf "secrets.values.%s is required when secrets.create=true" $key) -}}
{{- end -}}
{{- end -}}
{{- if not (regexMatch "^[A-Za-z0-9._~-]+$" (toString $v.DB_PASSWORD)) -}}
{{- fail "secrets.values.DB_PASSWORD must contain only URL-safe unreserved characters (A-Z a-z 0-9 . _ ~ -)" -}}
{{- end -}}
{{- end -}}
{{- end }}

{{/* Runs before any database connection; the Secret may come from outside Helm. */}}
{{- define "wr.passwordCheck" -}}
case "$DB_PASSWORD" in
  ""|*[!A-Za-z0-9._~-]*)
    echo "DB_PASSWORD must be non-empty and contain only URL-safe unreserved characters" >&2
    exit 1
    ;;
esac
{{- end }}
