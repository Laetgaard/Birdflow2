/**
 * The one way an HTTP route reports a cost ceiling.
 *
 * A run that stopped because it reached its ceiling is not a server fault and
 * is not worth retrying. A 500 says both of those things: the panel shows
 * "something went wrong", the customer presses the button again, and the same
 * refusal comes back. 402 with an explicit reason lets every client say what
 * actually happened and stop offering a retry.
 */
export function respondSpendLimit(
  res: { status: (code: number) => { json: (body: unknown) => unknown } },
  error?: { message?: string } | null
): void {
  res.status(402).json({
    message: error?.message || "Forespørgslen nåede sit omkostningsloft for én kørsel.",
    reason: "spend_limit",
    canRetry: false,
  });
}
