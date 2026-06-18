import type { Metadata } from "next";
import type * as React from "react";
import { SignInCard } from "@/components/auth/sign-in-card";

export const metadata: Metadata = {
	title: "Sign in",
};

export default function SignInPage(): React.JSX.Element {
	return <SignInCard />;
}
