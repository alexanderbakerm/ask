"use client";

import { EyeIcon, EyeOffIcon } from "lucide-react";
import * as React from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";

export type InputPasswordElement = HTMLDivElement;
export type InputPasswordProps = React.ComponentPropsWithoutRef<"input"> & {
	startAdornment?: React.ReactNode;
	endAdornment?: React.ReactNode;
};
const InputPassword = React.forwardRef<HTMLInputElement, InputPasswordProps>(
	({ startAdornment, endAdornment, className, ...props }, ref) => {
		const [showPassword, setShowPassword] = React.useState<boolean>(false);

		const handleClickShowPassword = (): void => {
			setShowPassword((prev) => !prev);
		};

		const handleMouseDownPassword = (event: React.SyntheticEvent): void => {
			event.preventDefault();
		};

		return (
			<InputGroup className={className}>
				{startAdornment && (
					<InputGroupAddon align="inline-start">
						<InputGroupText>{startAdornment}</InputGroupText>
					</InputGroupAddon>
				)}
				<InputGroupInput
					type={showPassword ? "text" : "password"}
					{...props}
					className={undefined}
					ref={ref}
				/>
				{(endAdornment || true) && (
					<InputGroupAddon align="inline-end">
						{endAdornment && <InputGroupText>{endAdornment}</InputGroupText>}
						<InputGroupButton
							type="button"
							variant="ghost"
							size="icon-xs"
							aria-label="Toggle password visibility"
							onClick={handleClickShowPassword}
							onMouseDown={handleMouseDownPassword}
							disabled={props.disabled}
						>
							{showPassword ? (
								<EyeOffIcon className="size-4 shrink-0" />
							) : (
								<EyeIcon className="size-4 shrink-0" />
							)}
						</InputGroupButton>
					</InputGroupAddon>
				)}
			</InputGroup>
		);
	},
);
InputPassword.displayName = "InputPassword";

export { InputPassword };
