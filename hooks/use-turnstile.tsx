"use client";

import type { TurnstileInstance } from "@marsidev/react-turnstile";
import { type RefObject, useCallback, useRef, useState } from "react";
import { toast } from "sonner";
import { env } from "@/lib/env";

type UseTurnstileReturn = {
	/** Ref to pass to the TurnstileCaptcha component. Do not reassign. */
	turnstileRef: RefObject<TurnstileInstance | null>;
	/** Current captcha token, empty string if not yet verified */
	captchaToken: string;
	/** Whether captcha is enabled (TURNSTILE_SITE_KEY is configured) */
	captchaEnabled: boolean;
	/** Reset the captcha widget and clear the token */
	resetCaptcha: () => void;
	/** Callback for successful captcha verification */
	handleSuccess: (token: string) => void;
	/** Callback for captcha error */
	handleError: () => void;
	/** Callback for captcha token expiration */
	handleExpire: () => void;
};

export function useTurnstile(): UseTurnstileReturn {
	const turnstileRef = useRef<TurnstileInstance>(null);
	const [captchaToken, setCaptchaToken] = useState("");
	const captchaEnabled = !!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

	const resetCaptcha = useCallback(() => {
		turnstileRef.current?.reset();
		setCaptchaToken("");
	}, []);

	const handleSuccess = useCallback((token: string) => {
		setCaptchaToken(token);
	}, []);

	const handleError = useCallback(() => {
		toast.error("CAPTCHA challenge failed. Please try again.");
		setCaptchaToken("");
	}, []);

	const handleExpire = useCallback(() => {
		toast.warning("CAPTCHA challenge expired. Please complete it again.");
		setCaptchaToken("");
	}, []);

	return {
		turnstileRef,
		captchaToken,
		captchaEnabled,
		resetCaptcha,
		handleSuccess,
		handleError,
		handleExpire,
	};
}
