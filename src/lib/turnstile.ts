interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
  action?: string;
  cdata?: string;
}

export async function verifyTurnstileToken(
  token: string | null | undefined,
  remoteIp?: string
): Promise<boolean> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;
  const siteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  if (!secretKey) {
    if (process.env.NODE_ENV === "production" && siteKey) {
      console.error(
        "[Turnstile] TURNSTILE_SECRET_KEY is missing in production while NEXT_PUBLIC_TURNSTILE_SITE_KEY is configured."
      );
      return false;
    }
    if (process.env.NODE_ENV !== "development") {
      console.warn("[Turnstile] TURNSTILE_SECRET_KEY is not configured.");
    }
    return true;
  }

  if (!token) {
    return false;
  }

  try {
    const formData = new URLSearchParams();
    formData.append("secret", secretKey);
    formData.append("response", token);
    if (remoteIp) {
      formData.append("remoteip", remoteIp);
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        body: formData,
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
      }
    );

    const data: TurnstileVerifyResponse = await response.json();
    return data.success;
  } catch (error) {
    console.error("[Turnstile] Verification request failed:", error);
    return false;
  }
}
