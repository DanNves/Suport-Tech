export type SupportErrorSeverity = "warning" | "error" | "critical";

export type SupportError = Error & {
  code: string;
  operation: string;
  userMessage: string;
  supportMessage: string;
  reference: string;
  severity: SupportErrorSeverity;
  original?: unknown;
};

type ErrorLike = {
  message?: string;
  details?: string;
  hint?: string;
  code?: string;
  status?: number;
  statusCode?: number;
  name?: string;
};

function reference() {
  const suffix = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(36).slice(2, 10).toUpperCase();
  return `SUP-${new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14)}-${suffix}`;
}

function readError(error: unknown): ErrorLike {
  if (error && typeof error === "object") return error as ErrorLike;
  return { message: String(error) };
}

function technicalText(value: ErrorLike) {
  return [value.code && `código=${value.code}`, value.status && `status=${value.status}`, value.statusCode && `statusCode=${value.statusCode}`, value.message, value.details, value.hint]
    .filter(Boolean)
    .join(" | ") || "Erro sem detalhes técnicos disponíveis.";
}

export function normalizeSupportError(error: unknown, operation: string, fallback = "Não foi possível concluir a operação."): SupportError {
  if ((error as SupportError)?.reference && (error as SupportError)?.operation) return error as SupportError;

  const value = readError(error);
  const code = String(value.code ?? "UNKNOWN");
  const message = String(value.message ?? "");
  const status = Number(value.status ?? value.statusCode ?? 0);
  let userMessage = fallback;
  let severity: SupportErrorSeverity = "error";

  if (code === "23503") userMessage = "O registro depende de um cadastro que ainda não existe ou não está vinculado corretamente.";
  else if (code === "23505") userMessage = "Este registro já existe. Verifique os dados informados e tente novamente.";
  else if (code === "23502") userMessage = "Faltam informações obrigatórias para concluir a operação.";
  else if (code === "42501" || status === 401 || status === 403) userMessage = "Você não possui permissão para realizar esta operação ou sua sessão precisa ser renovada.";
  else if (code === "22P02") userMessage = "Um dos dados enviados possui formato inválido.";
  else if (code === "PGRST116") userMessage = "O registro solicitado não foi encontrado.";
  else if (code.startsWith("PGRST")) userMessage = "O serviço de dados recusou ou não conseguiu processar a solicitação.";
  else if (/network|fetch|failed to fetch|offline|timeout/i.test(message)) userMessage = "Não foi possível comunicar com o servidor. Verifique sua conexão e tente novamente.";
  else if (/jwt|token|session|refresh token/i.test(message)) userMessage = "Sua sessão não está mais válida. Entre novamente no sistema.";
  else if (/profile/i.test(message) && /foreign key|not present/i.test(message)) userMessage = "Seu usuário ainda não está vinculado ao perfil do SuportTech. Solicite a regularização ao suporte.";
  else if (/not configured|placeholder/i.test(message)) {
    userMessage = "O ambiente do sistema não está configurado para acessar o banco de dados.";
    severity = "critical";
  }

  const result = new Error(userMessage) as SupportError;
  result.name = "SuportTechError";
  result.code = code;
  result.operation = operation;
  result.userMessage = userMessage;
  result.supportMessage = technicalText(value);
  result.reference = reference();
  result.severity = severity;
  result.original = error;

  if (typeof console !== "undefined") {
    console.error("[SuportTech] erro", {
      reference: result.reference,
      operation,
      code,
      severity,
      technical: result.supportMessage,
      route: typeof window !== "undefined" ? window.location.pathname : undefined,
    });
  }

  return result;
}

export function getSupportErrorDetails(error: unknown, operation: string, fallback?: string) {
  return normalizeSupportError(error, operation, fallback);
}

export function installGlobalErrorHandlers() {
  if (typeof window === "undefined") return () => undefined;

  const onError = (event: ErrorEvent) => {
    normalizeSupportError(event.error ?? event.message, "runtime_error", "Ocorreu um erro inesperado na aplicação.");
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    normalizeSupportError(event.reason, "unhandled_promise", "Ocorreu um erro inesperado ao processar uma operação.");
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);
  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}
