import { Response } from "express";

interface SuccessResponse<T> {
  success: true;
  data: T;
  message: string;
  error: null;
}

interface ErrorResponse {
  success: false;
  data: null;
  message: string;
  error: {
    code: string;
    details: string;
  };
}

export const sendSuccess = <T>(
  res: Response,
  data: T,
  message = "Success",
  statusCode = 200
): void => {
  const response: SuccessResponse<T> = {
    success: true,
    data,
    message,
    error: null,
  };
  res.status(statusCode).json(response);
};

export const sendError = (
  res: Response,
  message: string,
  statusCode = 500,
  code = "SERVER_ERROR",
  details = ""
): void => {
  const response: ErrorResponse = {
    success: false,
    data: null,
    message,
    error: { code, details },
  };
  res.status(statusCode).json(response);
};
