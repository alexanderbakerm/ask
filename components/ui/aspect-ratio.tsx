"use client";

import * as AspectRatioPrimitive from "@radix-ui/react-aspect-ratio";
import type * as React from "react";

export type AspectRatioElement = React.ComponentRef<
	typeof AspectRatioPrimitive.Root
>;
export type AspectRatioProps = React.ComponentPropsWithoutRef<
	typeof AspectRatioPrimitive.Root
>;

function AspectRatio({ ...props }: AspectRatioProps): React.JSX.Element {
	return <AspectRatioPrimitive.Root data-slot="aspect-ratio" {...props} />;
}

export { AspectRatio };
