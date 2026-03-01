import { RequestHandler } from "express";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requireUserIdHeader: RequestHandler = (request, response, next) => {
  const userId = request.header("x-user-id");

  if (!userId) {
    response.status(400).json({
      message: "x-user-id header is required.",
    });
    return;
  }

  if (!UUID_REGEX.test(userId)) {
    response.status(400).json({
      message: "x-user-id header must be a valid UUID.",
    });
    return;
  }

  next();
};
