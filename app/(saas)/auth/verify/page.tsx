import type { Metadata } from "next";
import type * as React from "react";
import { OtpCard } from "@/components/auth/otp-card";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const metadata: Metadata = {
	title: "Verify your account",
};

export default function VerifyPage(): React.JSX.Element {
	return <OtpCard />;
}
