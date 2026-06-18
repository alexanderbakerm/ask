import type { Metadata } from "next";
import type * as React from "react";
import { ForgotPasswordCard } from "@/components/auth/forgot-password-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Forgot password",
};

export default function ForgotPasswordPage(): React.JSX.Element {
	return <ForgotPasswordCard />;
}
