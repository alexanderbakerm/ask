import type { Metadata } from "next";
import type * as React from "react";
import { ResetPasswordCard } from "@/components/auth/reset-password-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Reset your password",
};

export default function ResetPasswordPage(): React.JSX.Element {
	return <ResetPasswordCard />;
}
