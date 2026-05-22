import { Response } from 'express';

export interface BilingualMessage {
  vi: string;
  zh: string;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data: T | null;
  messages: BilingualMessage;
}

/**
 * Send a standardized success response
 */
export const sendSuccess = <T>(
  res: Response,
  data: T | null = null,
  messages: BilingualMessage = { vi: 'Thành công', zh: '成功' },
  statusCode: number = 200
) => {
  const response: ApiResponse<T> = {
    success: true,
    data,
    messages
  };
  return res.status(statusCode).json(response);
};

/**
 * Send a standardized error response
 */
export const sendError = (
  res: Response,
  messages: BilingualMessage = { vi: 'Đã xảy ra lỗi', zh: '发生了错误' },
  statusCode: number = 400,
  data: any = null
) => {
  const response: ApiResponse<any> = {
    success: false,
    data,
    messages
  };
  return res.status(statusCode).json(response);
};
