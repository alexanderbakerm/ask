import { notFound } from "next/navigation";
import type * as React from "react";

export default function CatchAll(): React.JSX.Element {
	notFound();
}
