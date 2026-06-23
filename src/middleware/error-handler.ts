import type { ErrorHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import {
  ForbiddenError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
} from "../lib/errors";
import type { Env, Variables } from "../types";

type ProblemDetail = {
  type: string;
  title: string;
  status: number;
  detail?: string;
};

export const errorHandler: ErrorHandler<{
  Bindings: Env;
  Variables: Variables;
}> = (err, c) => {
  const problem: ProblemDetail = {
    type: "about:blank",
    title: "",
    status: 500,
  };

  if (err instanceof UnauthorizedError) {
    problem.title = "Unauthorized";
    problem.status = 401;
    problem.detail = err.message;
  } else if (err instanceof ForbiddenError) {
    problem.title = "Forbidden";
    problem.status = 403;
    problem.detail = err.message;
  } else if (err instanceof NotFoundError) {
    problem.title = "Not Found";
    problem.status = 404;
    problem.detail = err.message;
  } else if (err instanceof ValidationError) {
    problem.title = "Unprocessable Entity";
    problem.status = 422;
    problem.detail = err.message;
  } else if (err instanceof HTTPException) {
    problem.title = err.message;
    problem.status = err.status;
    problem.detail = err.message;
  } else {
    problem.title = "Internal Server Error";
    problem.status = 500;
    problem.detail = "An unexpected error occurred";
  }

  return c.json(problem, problem.status as 400, {
    "Content-Type": "application/problem+json",
  });
};
