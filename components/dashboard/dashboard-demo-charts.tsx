"use client";

import { ArrowDown, ArrowUp, Menu, TrendingUp } from "lucide-react";
import { useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Line,
	LineChart,
	XAxis,
} from "recharts";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	type ChartConfig,
	ChartContainer,
	ChartTooltip,
	ChartTooltipContent,
} from "@/components/ui/chart";

export default function DashboardDemo() {
	const emailsSent = useMemo(() => generateSampleMetrics(), []);
	const deliveryRate = useMemo(() => generateSampleMetrics(), []);
	const subscribers = useMemo(() => generateSampleMetrics(), []);
	const bounceRate = useMemo(() => generateSampleMetrics(), []);

	return (
		<div className="fade-in flex animate-in flex-col space-y-4 duration-500">
			<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2.5">
							<span>Emails Sent</span>
							<TrendIndicator trend="up">18%</TrendIndicator>
						</CardTitle>

						<CardDescription>
							<span>Total emails delivered</span>
						</CardDescription>

						<div>
							<MetricFigure>{`${Number(emailsSent[1]).toFixed(0)}k`}</MetricFigure>
						</div>
					</CardHeader>

					<CardContent className="space-y-4">
						<KpiSparkline data={emailsSent[0]} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2.5">
							<span>Delivery Rate</span>
							<TrendIndicator trend="up">2.3%</TrendIndicator>
						</CardTitle>

						<CardDescription>
							<span>Successfully delivered</span>
						</CardDescription>

						<div>
							<MetricFigure>{`${(95 + Number(deliveryRate[1]) * 0.5).toFixed(1)}%`}</MetricFigure>
						</div>
					</CardHeader>

					<CardContent>
						<KpiSparkline data={deliveryRate[0]} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2.5">
							<span>Subscribers</span>
							<TrendIndicator trend="up">12%</TrendIndicator>
						</CardTitle>

						<CardDescription>
							<span>Active email list size</span>
						</CardDescription>

						<div>
							<MetricFigure>{`${Number(subscribers[1]).toFixed(0)}k`}</MetricFigure>
						</div>
					</CardHeader>

					<CardContent>
						<KpiSparkline data={subscribers[0]} />
					</CardContent>
				</Card>

				<Card>
					<CardHeader>
						<CardTitle className="flex items-center gap-2.5">
							<span>Bounce Rate</span>
							<TrendIndicator trend="down">-0.8%</TrendIndicator>
						</CardTitle>

						<CardDescription>
							<span>Failed deliveries</span>
						</CardDescription>

						<div>
							<MetricFigure>{`${(Number(bounceRate[1]) * 0.3).toFixed(1)}%`}</MetricFigure>
						</div>
					</CardHeader>

					<CardContent>
						<KpiSparkline data={bounceRate[0]} />
					</CardContent>
				</Card>
			</div>

			<EmailsSentChart />

			<EmailPerformanceChart />
		</div>
	);
}

function generateSampleMetrics() {
	const currentDate = new Date();
	const dateFormatter = new Intl.DateTimeFormat("en-us", {
		month: "short",
		year: "2-digit",
	});

	const metrics: { value: string; name: string }[] = [];

	for (let i = 8; i > 0; i -= 1) {
		const targetDate = new Date(
			currentDate.getFullYear(),
			currentDate.getMonth() - i,
			1,
		);

		metrics.push({
			name: dateFormatter.format(targetDate),
			value: (Math.random() * 10).toFixed(1),
		});
	}

	const currentValue = metrics[metrics.length - 1]?.value;

	return [metrics, currentValue] as [typeof metrics, string];
}

function KpiSparkline(
	props: React.PropsWithChildren<{ data: { value: string; name: string }[] }>,
) {
	const chartSettings = {
		primary: {
			label: "Primary",
			color: "var(--chart-1)",
		},
		secondary: {
			label: "Secondary",
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<ChartContainer config={chartSettings}>
			<LineChart accessibilityLayer data={props.data}>
				<CartesianGrid vertical={false} />
				<XAxis
					dataKey="name"
					tickLine={false}
					axisLine={false}
					tickMargin={8}
				/>
				<ChartTooltip
					cursor={false}
					content={<ChartTooltipContent hideLabel />}
				/>
				<Line
					dataKey="value"
					type="natural"
					stroke="var(--color-primary)"
					strokeWidth={2}
					dot={false}
				/>
			</LineChart>
		</ChartContainer>
	);
}

function MetricFigure(props: React.PropsWithChildren) {
	return (
		<div className="font-heading font-semibold text-2xl">{props.children}</div>
	);
}

function TrendBadge(props: React.PropsWithChildren<{ trend: string }>) {
	const className = useMemo(() => {
		switch (props.trend) {
			case "up":
				return "text-green-500";
			case "down":
				return "text-destructive";
			case "stale":
				return "text-orange-500";
		}
	}, [props.trend]);

	return (
		<Badge variant="outline" className="border-transparent px-1.5 font-normal">
			<span className={className}>{props.children}</span>
		</Badge>
	);
}

function TrendIndicator(
	props: React.PropsWithChildren<{
		trend: "up" | "down" | "stale";
	}>,
) {
	const Icon = useMemo(() => {
		switch (props.trend) {
			case "up":
				return <ArrowUp className="h-3 w-3 text-green-500" />;
			case "down":
				return <ArrowDown className="h-3 w-3 text-destructive" />;
			case "stale":
				return <Menu className="h-3 w-3 text-orange-500" />;
		}
	}, [props.trend]);

	return (
		<div>
			<TrendBadge trend={props.trend}>
				<span className="flex items-center space-x-1">
					{Icon}
					<span>{props.children}</span>
				</span>
			</TrendBadge>
		</div>
	);
}

export function EmailsSentChart() {
	const emailData = useMemo(
		() => [
			{ date: "2025-10-01", marketing: 245, transactional: 168 },
			{ date: "2025-10-02", marketing: 112, transactional: 195 },
			{ date: "2025-10-03", marketing: 183, transactional: 138 },
			{ date: "2025-10-04", marketing: 267, transactional: 278 },
			{ date: "2025-10-05", marketing: 398, transactional: 312 },
			{ date: "2025-10-06", marketing: 324, transactional: 358 },
			{ date: "2025-10-07", marketing: 268, transactional: 198 },
			{ date: "2025-10-08", marketing: 432, transactional: 342 },
			{ date: "2025-10-09", marketing: 78, transactional: 128 },
			{ date: "2025-10-10", marketing: 284, transactional: 208 },
			{ date: "2025-10-11", marketing: 352, transactional: 368 },
			{ date: "2025-10-12", marketing: 315, transactional: 228 },
			{ date: "2025-10-13", marketing: 367, transactional: 398 },
			{ date: "2025-10-14", marketing: 158, transactional: 238 },
			{ date: "2025-10-15", marketing: 142, transactional: 188 },
			{ date: "2025-10-16", marketing: 156, transactional: 208 },
			{ date: "2025-10-17", marketing: 468, transactional: 378 },
			{ date: "2025-10-18", marketing: 387, transactional: 428 },
			{ date: "2025-10-19", marketing: 265, transactional: 198 },
			{ date: "2025-10-20", marketing: 108, transactional: 168 },
			{ date: "2025-10-21", marketing: 156, transactional: 218 },
			{ date: "2025-10-22", marketing: 247, transactional: 188 },
			{ date: "2025-10-23", marketing: 158, transactional: 248 },
			{ date: "2025-10-24", marketing: 408, transactional: 308 },
			{ date: "2025-10-25", marketing: 238, transactional: 268 },
			{ date: "2025-10-26", marketing: 94, transactional: 148 },
			{ date: "2025-10-27", marketing: 405, transactional: 438 },
			{ date: "2025-10-28", marketing: 145, transactional: 198 },
			{ date: "2025-10-29", marketing: 338, transactional: 258 },
			{ date: "2025-10-30", marketing: 478, transactional: 398 },
			{ date: "2025-10-31", marketing: 188, transactional: 238 },
			{ date: "2025-11-01", marketing: 315, transactional: 328 },
			{ date: "2025-11-02", marketing: 268, transactional: 208 },
			{ date: "2025-11-03", marketing: 408, transactional: 438 },
			{ date: "2025-11-04", marketing: 502, transactional: 408 },
			{ date: "2025-11-05", marketing: 518, transactional: 538 },
			{ date: "2025-11-06", marketing: 408, transactional: 318 },
			{ date: "2025-11-07", marketing: 168, transactional: 228 },
			{ date: "2025-11-08", marketing: 248, transactional: 198 },
			{ date: "2025-11-09", marketing: 315, transactional: 348 },
			{ date: "2025-11-10", marketing: 358, transactional: 288 },
			{ date: "2025-11-11", marketing: 218, transactional: 258 },
			{ date: "2025-11-12", marketing: 218, transactional: 178 },
			{ date: "2025-11-13", marketing: 468, transactional: 508 },
			{ date: "2025-11-14", marketing: 495, transactional: 398 },
			{ date: "2025-11-15", marketing: 358, transactional: 418 },
			{ date: "2025-11-16", marketing: 518, transactional: 438 },
			{ date: "2025-11-17", marketing: 338, transactional: 368 },
			{ date: "2025-11-18", marketing: 258, transactional: 198 },
			{ date: "2025-11-19", marketing: 198, transactional: 248 },
			{ date: "2025-11-20", marketing: 102, transactional: 158 },
			{ date: "2025-11-21", marketing: 98, transactional: 138 },
			{ date: "2025-11-22", marketing: 275, transactional: 308 },
			{ date: "2025-11-23", marketing: 318, transactional: 238 },
			{ date: "2025-11-24", marketing: 225, transactional: 268 },
			{ date: "2025-11-25", marketing: 238, transactional: 188 },
			{ date: "2025-11-26", marketing: 445, transactional: 478 },
			{ date: "2025-11-27", marketing: 258, transactional: 208 },
			{ date: "2025-11-28", marketing: 98, transactional: 148 },
			{ date: "2025-11-29", marketing: 365, transactional: 298 },
			{ date: "2025-11-30", marketing: 198, transactional: 248 },
			{ date: "2025-12-01", marketing: 198, transactional: 218 },
			{ date: "2025-12-02", marketing: 495, transactional: 428 },
			{ date: "2025-12-03", marketing: 125, transactional: 178 },
			{ date: "2025-12-04", marketing: 462, transactional: 398 },
			{ date: "2025-12-05", marketing: 108, transactional: 158 },
			{ date: "2025-12-06", marketing: 318, transactional: 268 },
			{ date: "2025-12-07", marketing: 348, transactional: 388 },
			{ date: "2025-12-08", marketing: 408, transactional: 338 },
			{ date: "2025-12-09", marketing: 462, transactional: 498 },
			{ date: "2025-12-10", marketing: 178, transactional: 218 },
			{ date: "2025-12-11", marketing: 112, transactional: 168 },
			{ date: "2025-12-12", marketing: 515, transactional: 438 },
			{ date: "2025-12-13", marketing: 98, transactional: 148 },
			{ date: "2025-12-14", marketing: 448, transactional: 398 },
			{ date: "2025-12-15", marketing: 328, transactional: 368 },
		],
		[],
	);

	const chartConfig = {
		emails: {
			label: "Emails",
		},
		marketing: {
			label: "Marketing",
			color: "var(--chart-1)",
		},
		transactional: {
			label: "Transactional",
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Emails Sent</CardTitle>
				<CardDescription>
					Email delivery breakdown for the last quarter
				</CardDescription>
			</CardHeader>

			<CardContent>
				<ChartContainer className="h-64 w-full" config={chartConfig}>
					<AreaChart accessibilityLayer data={emailData}>
						<defs>
							<linearGradient id="fillMarketing" x1="0" y1="0" x2="0" y2="1">
								<stop
									offset="5%"
									stopColor="var(--color-marketing)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-marketing)"
									stopOpacity={0.1}
								/>
							</linearGradient>
							<linearGradient
								id="fillTransactional"
								x1="0"
								y1="0"
								x2="0"
								y2="1"
							>
								<stop
									offset="5%"
									stopColor="var(--color-transactional)"
									stopOpacity={0.8}
								/>
								<stop
									offset="95%"
									stopColor="var(--color-transactional)"
									stopOpacity={0.1}
								/>
							</linearGradient>
						</defs>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value: string) => {
								const date = new Date(value);
								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							}}
						/>
						<ChartTooltip
							cursor={false}
							content={<ChartTooltipContent indicator="dot" />}
						/>
						<Area
							dataKey="transactional"
							type="natural"
							fill="url(#fillTransactional)"
							fillOpacity={0.4}
							stroke="var(--color-transactional)"
							stackId="a"
						/>
						<Area
							dataKey="marketing"
							type="natural"
							fill="url(#fillMarketing)"
							fillOpacity={0.4}
							stroke="var(--color-marketing)"
							stackId="a"
						/>
					</AreaChart>
				</ChartContainer>
			</CardContent>

			<CardFooter>
				<div className="flex w-full items-start gap-2 text-sm">
					<div className="grid gap-2">
						<div className="flex items-center gap-2 font-medium leading-none">
							Up 4.8% from last quarter <TrendingUp className="h-4 w-4" />
						</div>
						<div className="flex items-center gap-2 text-muted-foreground leading-none">
							October - December 2025
						</div>
					</div>
				</div>
			</CardFooter>
		</Card>
	);
}

export function EmailPerformanceChart() {
	const [selectedMetric, setSelectedMetric] =
		useState<keyof typeof chartConfig>("openRate");

	const emailPerformanceData = [
		{ date: "2025-10-01", openRate: 32.4, clickRate: 2.8 },
		{ date: "2025-10-02", openRate: 28.6, clickRate: 3.2 },
		{ date: "2025-10-03", openRate: 35.2, clickRate: 2.4 },
		{ date: "2025-10-04", openRate: 38.1, clickRate: 3.8 },
		{ date: "2025-10-05", openRate: 41.5, clickRate: 4.2 },
		{ date: "2025-10-06", openRate: 36.8, clickRate: 3.5 },
		{ date: "2025-10-07", openRate: 33.2, clickRate: 2.9 },
		{ date: "2025-10-08", openRate: 42.8, clickRate: 4.5 },
		{ date: "2025-10-09", openRate: 25.4, clickRate: 1.8 },
		{ date: "2025-10-10", openRate: 34.6, clickRate: 3.1 },
		{ date: "2025-10-11", openRate: 38.9, clickRate: 3.9 },
		{ date: "2025-10-12", openRate: 35.8, clickRate: 3.2 },
		{ date: "2025-10-13", openRate: 39.4, clickRate: 4.1 },
		{ date: "2025-10-14", openRate: 29.8, clickRate: 2.6 },
		{ date: "2025-10-15", openRate: 27.5, clickRate: 2.3 },
		{ date: "2025-10-16", openRate: 30.2, clickRate: 2.7 },
		{ date: "2025-10-17", openRate: 44.6, clickRate: 4.8 },
		{ date: "2025-10-18", openRate: 40.2, clickRate: 4.3 },
		{ date: "2025-10-19", openRate: 33.8, clickRate: 2.9 },
		{ date: "2025-10-20", openRate: 26.4, clickRate: 2.1 },
		{ date: "2025-10-21", openRate: 29.6, clickRate: 2.5 },
		{ date: "2025-10-22", openRate: 32.8, clickRate: 2.8 },
		{ date: "2025-10-23", openRate: 30.4, clickRate: 2.6 },
		{ date: "2025-10-24", openRate: 41.2, clickRate: 4.2 },
		{ date: "2025-10-25", openRate: 34.2, clickRate: 3.2 },
		{ date: "2025-10-26", openRate: 24.8, clickRate: 1.9 },
		{ date: "2025-10-27", openRate: 42.4, clickRate: 4.6 },
		{ date: "2025-10-28", openRate: 28.4, clickRate: 2.4 },
		{ date: "2025-10-29", openRate: 37.2, clickRate: 3.6 },
		{ date: "2025-10-30", openRate: 45.8, clickRate: 4.9 },
		{ date: "2025-10-31", openRate: 31.6, clickRate: 2.8 },
		{ date: "2025-11-01", openRate: 36.4, clickRate: 3.5 },
		{ date: "2025-11-02", openRate: 33.2, clickRate: 3.0 },
		{ date: "2025-11-03", openRate: 42.6, clickRate: 4.5 },
		{ date: "2025-11-04", openRate: 46.2, clickRate: 5.1 },
		{ date: "2025-11-05", openRate: 48.4, clickRate: 5.4 },
		{ date: "2025-11-06", openRate: 41.2, clickRate: 4.2 },
		{ date: "2025-11-07", openRate: 29.4, clickRate: 2.5 },
		{ date: "2025-11-08", openRate: 32.6, clickRate: 2.9 },
		{ date: "2025-11-09", openRate: 36.8, clickRate: 3.6 },
		{ date: "2025-11-10", openRate: 38.2, clickRate: 3.8 },
		{ date: "2025-11-11", openRate: 31.8, clickRate: 2.8 },
		{ date: "2025-11-12", openRate: 30.4, clickRate: 2.6 },
		{ date: "2025-11-13", openRate: 44.8, clickRate: 4.8 },
		{ date: "2025-11-14", openRate: 45.6, clickRate: 4.9 },
		{ date: "2025-11-15", openRate: 39.4, clickRate: 4.1 },
		{ date: "2025-11-16", openRate: 47.2, clickRate: 5.2 },
		{ date: "2025-11-17", openRate: 37.4, clickRate: 3.7 },
		{ date: "2025-11-18", openRate: 33.4, clickRate: 3.0 },
		{ date: "2025-11-19", openRate: 31.2, clickRate: 2.7 },
		{ date: "2025-11-20", openRate: 25.6, clickRate: 2.0 },
		{ date: "2025-11-21", openRate: 24.2, clickRate: 1.8 },
		{ date: "2025-11-22", openRate: 35.4, clickRate: 3.4 },
		{ date: "2025-11-23", openRate: 36.8, clickRate: 3.5 },
		{ date: "2025-11-24", openRate: 33.6, clickRate: 3.1 },
		{ date: "2025-11-25", openRate: 32.4, clickRate: 2.9 },
		{ date: "2025-11-26", openRate: 43.8, clickRate: 4.7 },
		{ date: "2025-11-27", openRate: 34.2, clickRate: 3.2 },
		{ date: "2025-11-28", openRate: 24.6, clickRate: 1.9 },
		{ date: "2025-11-29", openRate: 38.6, clickRate: 3.9 },
		{ date: "2025-11-30", openRate: 31.4, clickRate: 2.8 },
		{ date: "2025-12-01", openRate: 31.8, clickRate: 2.9 },
		{ date: "2025-12-02", openRate: 46.4, clickRate: 5.0 },
		{ date: "2025-12-03", openRate: 27.2, clickRate: 2.2 },
		{ date: "2025-12-04", openRate: 44.2, clickRate: 4.6 },
		{ date: "2025-12-05", openRate: 26.4, clickRate: 2.1 },
		{ date: "2025-12-06", openRate: 36.4, clickRate: 3.5 },
		{ date: "2025-12-07", openRate: 38.8, clickRate: 3.9 },
		{ date: "2025-12-08", openRate: 41.6, clickRate: 4.3 },
		{ date: "2025-12-09", openRate: 45.2, clickRate: 4.9 },
		{ date: "2025-12-10", openRate: 30.2, clickRate: 2.7 },
		{ date: "2025-12-11", openRate: 26.8, clickRate: 2.2 },
		{ date: "2025-12-12", openRate: 47.6, clickRate: 5.2 },
		{ date: "2025-12-13", openRate: 25.4, clickRate: 2.0 },
		{ date: "2025-12-14", openRate: 43.6, clickRate: 4.6 },
		{ date: "2025-12-15", openRate: 37.8, clickRate: 3.8 },
	];

	const chartConfig = {
		performance: {
			label: "Performance",
		},
		openRate: {
			label: "Open Rate",
			color: "var(--chart-1)",
		},
		clickRate: {
			label: "Click Rate",
			color: "var(--chart-2)",
		},
	} satisfies ChartConfig;

	const averages = useMemo(
		() => ({
			openRate:
				emailPerformanceData.reduce((acc, curr) => acc + curr.openRate, 0) /
				emailPerformanceData.length,
			clickRate:
				emailPerformanceData.reduce((acc, curr) => acc + curr.clickRate, 0) /
				emailPerformanceData.length,
		}),
		[emailPerformanceData],
	);

	return (
		<Card className="py-0">
			<CardHeader className="flex flex-col items-stretch space-y-0 border-b p-0! sm:flex-row">
				<div className="flex flex-1 flex-col justify-center gap-1 px-6 py-5 sm:py-6">
					<CardTitle>Email Performance</CardTitle>

					<CardDescription>
						Open and click rates for the last 3 months
					</CardDescription>
				</div>

				<div className="flex">
					{(["openRate", "clickRate"] as const).map((key) => {
						const chart = key as keyof typeof chartConfig;
						return (
							<button
								type="button"
								key={chart}
								data-active={selectedMetric === chart}
								className="relative z-30 flex flex-1 cursor-pointer flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l data-[active=true]:bg-muted/50 sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
								onClick={() => setSelectedMetric(chart)}
							>
								<span className="text-muted-foreground text-xs">
									{chartConfig[chart].label}
								</span>
								<span className="font-bold text-base leading-none sm:text-xl">
									{averages[key as keyof typeof averages].toFixed(1)}%
								</span>
							</button>
						);
					})}
				</div>
			</CardHeader>

			<CardContent className="px-2 py-0 sm:px-6">
				<ChartContainer
					config={chartConfig}
					className="aspect-auto h-64 w-full"
				>
					<BarChart accessibilityLayer data={emailPerformanceData}>
						<CartesianGrid vertical={false} />
						<XAxis
							dataKey="date"
							tickLine={false}
							axisLine={false}
							tickMargin={8}
							minTickGap={32}
							tickFormatter={(value) => {
								const date = new Date(value);
								return date.toLocaleDateString("en-US", {
									month: "short",
									day: "numeric",
								});
							}}
						/>
						<ChartTooltip
							content={
								<ChartTooltipContent
									className="w-[150px]"
									nameKey="performance"
									labelFormatter={(value) => {
										return new Date(value as string).toLocaleDateString(
											"en-US",
											{
												month: "short",
												day: "numeric",
												year: "numeric",
											},
										);
									}}
								/>
							}
						/>
						<Bar
							dataKey={selectedMetric}
							fill={`var(--color-${selectedMetric})`}
						/>
					</BarChart>
				</ChartContainer>
			</CardContent>
		</Card>
	);
}
