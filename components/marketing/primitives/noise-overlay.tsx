import { cn } from "@/lib/utils";

interface NoiseOverlayProps {
	className?: string;
}

/**
 * SVG noise texture overlay for gradient cards
 * Creates a subtle grain effect that adds depth
 */
export function NoiseOverlay({ className }: NoiseOverlayProps) {
	// Inline SVG as data URI for the noise texture
	const noiseSvg = `data:image/svg+xml;charset=utf-8,%20%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22250%22%20height%3D%22250%22%20viewBox%3D%220%200%20100%20100%22%3E%20%3Cfilter%20id%3D%22n%22%3E%20%3CfeTurbulence%20type%3D%22turbulence%22%20baseFrequency%3D%221.4%22%20numOctaves%3D%221%22%20seed%3D%222%22%20stitchTiles%3D%22stitch%22%20result%3D%22n%22%20%2F%3E%20%3CfeComponentTransfer%20result%3D%22g%22%3E%20%3CfeFuncR%20type%3D%22linear%22%20slope%3D%224%22%20intercept%3D%221%22%20%2F%3E%20%3CfeFuncG%20type%3D%22linear%22%20slope%3D%224%22%20intercept%3D%221%22%20%2F%3E%20%3CfeFuncB%20type%3D%22linear%22%20slope%3D%224%22%20intercept%3D%221%22%20%2F%3E%20%3C%2FfeComponentTransfer%3E%20%3CfeColorMatrix%20type%3D%22saturate%22%20values%3D%220%22%20in%3D%22g%22%20%2F%3E%20%3C%2Ffilter%3E%20%3Crect%20width%3D%22100%25%22%20height%3D%22100%25%22%20filter%3D%22url(%23n)%22%20%2F%3E%20%3C%2Fsvg%3E%20`;

	return (
		<div
			aria-hidden="true"
			className={cn(
				"pointer-events-none absolute inset-0 opacity-50 mix-blend-overlay dark:opacity-40",
				className,
			)}
			style={{
				backgroundPosition: "center",
				backgroundImage: `url("${noiseSvg}")`,
			}}
		/>
	);
}
