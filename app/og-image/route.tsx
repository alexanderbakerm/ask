import { ImageResponse } from "next/og";
import { appConfig } from "@/config/app.config";

export const runtime = "edge";

function OgImage(): React.JSX.Element {
	return (
		<div
			style={{
				display: "flex",
				width: "100%",
				height: "100%",
				flexDirection: "column",
				justifyContent: "center",
				alignItems: "center",
				backgroundColor: "#000000",
				color: "white",
				position: "relative",
			}}
		>
			<div
				style={{
					position: "absolute",
					top: "24px",
					left: "24px",
					right: "24px",
					bottom: "24px",
					border: "2px solid rgba(255, 255, 255, 0.2)",
					borderRadius: "16px",
				}}
			/>

			<div
				style={{
					display: "flex",
					flexDirection: "column",
					justifyContent: "center",
					alignItems: "center",
					textAlign: "center",
					padding: "48px",
					maxWidth: "800px",
					zIndex: "10",
				}}
			>
				<div
					style={{
						fontSize: "72px",
						fontWeight: "800",
						lineHeight: "1.2",
						color: "#f8f8f8",
						textShadow: "0 4px 8px rgba(0, 0, 0, 0.5)",
					}}
				>
					{appConfig.appName}
				</div>

				<div
					style={{
						marginTop: "24px",
						fontSize: "28px",
						fontWeight: "400",
						lineHeight: "1.6",
						color: "rgba(255, 255, 255, 0.75)",
					}}
				>
					{appConfig.description}
				</div>
			</div>
			{[
				{ top: "24px", left: "24px" },
				{ top: "24px", right: "24px" },
				{ bottom: "24px", left: "24px" },
				{ bottom: "24px", right: "24px" },
			].map((position, index) => (
				<div
					key={index}
					style={{
						position: "absolute",
						width: "12px",
						height: "12px",
						borderRadius: "50%",
						backgroundColor: "#f8f8f8",
						...position,
					}}
				/>
			))}
		</div>
	);
}

export async function GET() {
	return new ImageResponse(<OgImage />, {
		width: 1200,
		height: 630,
	});
}
