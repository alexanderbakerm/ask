"use client";

import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";
import type * as React from "react";
import { Logo } from "@/components/logo";
import { authUiConfig } from "@/config/auth-ui.config";
import { cn } from "@/lib/utils";

export type AuthTestimonial = {
	avatarSrc: string;
	name: string;
	handle: string;
	text: string;
};

type AuthPageShellProps = {
	title: React.ReactNode;
	description: React.ReactNode;
	children: React.ReactNode;
	footer?: React.ReactNode;
	socialSection?: React.ReactNode;
	testimonials?: AuthTestimonial[];
};

export function GoogleIcon({ className }: { className?: string }) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			className={cn("h-5 w-5", className)}
			viewBox="0 0 48 48"
			aria-hidden
		>
			<path
				fill="#FFC107"
				d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s12-5.373 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-2.641-.21-5.236-.611-7.743z"
			/>
			<path
				fill="#FF3D00"
				d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"
			/>
			<path
				fill="#4CAF50"
				d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"
			/>
			<path
				fill="#1976D2"
				d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.022 35.026 44 30.038 44 24c0-2.641-.21-5.236-.611-7.743z"
			/>
		</svg>
	);
}

export function GlassInputWrapper({
	children,
	className,
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<div
			className={cn(
				"rounded-2xl border border-border bg-foreground/5 backdrop-blur-sm transition-colors focus-within:border-violet-400/70 focus-within:bg-violet-500/10",
				className,
			)}
		>
			{children}
		</div>
	);
}

export function AuthPasswordToggle({
	showPassword,
	onToggle,
}: {
	showPassword: boolean;
	onToggle: () => void;
}) {
	return (
		<button
			type="button"
			onClick={onToggle}
			className="absolute inset-y-0 right-3 flex items-center"
			aria-label={showPassword ? "Hide password" : "Show password"}
		>
			{showPassword ? (
				<EyeOff className="size-5 text-muted-foreground transition-colors hover:text-foreground" />
			) : (
				<Eye className="size-5 text-muted-foreground transition-colors hover:text-foreground" />
			)}
		</button>
	);
}

function TestimonialCard({
	testimonial,
	delayClassName,
}: {
	testimonial: AuthTestimonial;
	delayClassName: string;
}) {
	return (
		<div
			className={cn(
				"animate-auth-testimonial flex w-64 items-start gap-3 rounded-3xl border border-white/30 bg-white/80 p-5 text-black shadow-lg backdrop-blur-xl",
				delayClassName,
			)}
		>
			<img
				src={testimonial.avatarSrc}
				className="size-10 rounded-2xl object-cover"
				alt=""
			/>
			<div className="text-sm leading-snug text-black">
				<p className="flex items-center gap-1 font-medium text-black">
					{testimonial.name}
				</p>
				<p className="text-black/70">{testimonial.handle}</p>
				<p className="mt-1 text-black">{testimonial.text}</p>
			</div>
		</div>
	);
}

export function AuthGoogleButton({
	onClick,
	disabled,
	loading,
}: {
	onClick: () => void;
	disabled?: boolean;
	loading?: boolean;
}) {
	return (
		<button
			type="button"
			onClick={onClick}
			disabled={disabled || loading}
			className="animate-element animate-delay-800 flex w-full items-center justify-center gap-3 rounded-2xl border border-border py-4 transition-colors hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-60"
		>
			<GoogleIcon />
			Continue with Google
		</button>
	);
}

export function AuthDivider() {
	return (
		<div className="animate-element animate-delay-700 relative flex items-center justify-center">
			<span className="w-full border-t border-border" />
			<span className="absolute bg-background px-4 text-sm text-muted-foreground">
				Or continue with
			</span>
		</div>
	);
}

export function AuthPageShell({
	title,
	description,
	children,
	footer,
	socialSection,
	testimonials = authUiConfig.testimonials,
}: AuthPageShellProps) {
	return (
		<div className="flex min-h-[100dvh] w-full flex-col font-sans md:flex-row">
			<section className="flex flex-1 items-center justify-center p-6 sm:p-8">
				<div className="w-full max-w-md">
					<div className="mb-8">
						<Link href="/" className="inline-flex">
							<Logo />
						</Link>
					</div>

					<div className="flex flex-col gap-6">
						<h1 className="animate-element animate-delay-100 text-4xl font-semibold leading-tight tracking-tighter md:text-5xl">
							{title}
						</h1>
						<p className="animate-element animate-delay-200 text-muted-foreground">
							{description}
						</p>

						{children}

						{socialSection}

						{footer ? (
							<div className="animate-element animate-delay-900">{footer}</div>
						) : null}
					</div>
				</div>
			</section>

			<section className="relative hidden flex-1 overflow-hidden p-4 md:block">
				<div className="animate-auth-slide-right animate-delay-300 absolute inset-4 overflow-hidden rounded-3xl">
					<div
						className="absolute inset-0"
						style={{
							backgroundImage:
								"linear-gradient(135deg, #4DBFF0 0%, #009CDE 100%)",
						}}
					/>
					<img
						src="/auth/login-wave.png"
						alt=""
						className="pointer-events-none absolute inset-0 z-10 h-full w-full object-cover object-right"
					/>
				</div>
				{testimonials[0] ? (
					<div className="absolute bottom-8 left-1/2 z-20 flex w-full -translate-x-1/2 justify-center gap-4 px-8">
						<TestimonialCard
							testimonial={testimonials[0]}
							delayClassName="animate-delay-1000"
						/>
						{testimonials[1] ? (
							<div className="hidden xl:flex">
								<TestimonialCard
									testimonial={testimonials[1]}
									delayClassName="animate-delay-1200"
								/>
							</div>
						) : null}
						{testimonials[2] ? (
							<div className="hidden 2xl:flex">
								<TestimonialCard
									testimonial={testimonials[2]}
									delayClassName="animate-delay-1400"
								/>
							</div>
						) : null}
					</div>
				) : null}
			</section>
		</div>
	);
}
