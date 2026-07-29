import type { ErrorRequestHandler } from "express";

function isBodyParserSyntaxError(err: unknown): boolean {
  return (
    err instanceof SyntaxError &&
    "status" in err &&
    (err as { status?: number }).status === 400 &&
    "body" in err
  );
}

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (res.headersSent) {
    console.error(err);
    res.end();
    return;
  }

  if (isBodyParserSyntaxError(err)) {
    res.status(400).json({ error: "invalid_json_body" });
    return;
  }

  console.error(err);
  res.status(500).json({ error: "internal_server_error" });
};
