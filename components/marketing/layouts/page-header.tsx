import { cn } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	subtitle: string;
	container?: boolean;
	className?: string;
}

export function PageHeader({
	title,
	subtitle,
	container = true,
	className = "",
}: PageHeaderProps) {
	const containerClass = container ? "container" : "";

	return (
		<div
			className={cn(
				"border-border/40 border-b pt-28 pb-6 xl:pt-32 xl:pb-8 2xl:pb-10",
				className,
			)}
		>
			<div
				className={cn(
					"flex flex-col items-center gap-y-2 lg:gap-y-3",
					containerClass,
				)}
			>
				<h1 className="font-heading text-3xl tracking-tighter xl:text-5xl dark:text-white">
					{title}
				</h1>

				<h2 className="text-lg text-muted-foreground tracking-tight 2xl:text-2xl">
					{subtitle}
				</h2>
			</div>
		</div>
	);
}
