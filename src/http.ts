export function jsonError(message: string, status = 400) {
  return Response.json(
    {
      ok: false,
      error: {
        message,
      },
    },
    { status },
  );
}

export function jsonOk<T>(data: T, status = 200) {
  return Response.json(
    {
      ok: true,
      data,
    },
    { status },
  );
}
