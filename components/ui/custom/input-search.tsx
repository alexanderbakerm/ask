"use client";

import { SearchIcon, XIcon } from "lucide-react";
import * as React from "react";
import {
	InputGroup,
	InputGroupAddon,
	InputGroupButton,
	InputGroupInput,
	InputGroupText,
} from "@/components/ui/input-group";

export type InputSearchElement = HTMLDivElement;
export type InputSearchProps = React.ComponentPropsWithoutRef<"input"> & {
	debounceTime?: number;
	onClear?: () => void;
	clearButtonProps?: React.ComponentProps<typeof InputGroupButton>;
	alwaysShowClearButton?: boolean;
};
export const InputSearch = ({
	onChange,
	value,
	disabled,
	debounceTime = 175,
	onClear,
	clearButtonProps,
	alwaysShowClearButton,
	...props
}: InputSearchProps): React.JSX.Element => {
	const [innerValue, setInnerValue] = React.useState(value || "");
	const timeoutRef = React.useRef<NodeJS.Timeout | null>(null);
	const previousValueRef = React.useRef(value || "");

	React.useEffect(() => {
		const currentValue = value || "";
		if (currentValue !== previousValueRef.current) {
			setInnerValue(currentValue);
			previousValueRef.current = currentValue;
		}
	}, [value]);

	const handleChange = React.useCallback(
		(event: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = event.target.value;
			setInnerValue(newValue);

			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			timeoutRef.current = setTimeout(() => {
				const clonedEvent = {
					...event,
					target: { ...event.target, value: newValue },
					currentTarget: { ...event.currentTarget, value: newValue },
				} as React.ChangeEvent<HTMLInputElement>;
				onChange?.(clonedEvent);
			}, debounceTime);
		},
		[onChange, debounceTime],
	);

	const handleClear = React.useCallback(() => {
		setInnerValue("");
		if (timeoutRef.current) {
			clearTimeout(timeoutRef.current);
		}
		const syntheticEvent = {
			target: { value: "" },
			currentTarget: { value: "" },
			type: "change",
			nativeEvent: new Event("input", { bubbles: true }),
			preventDefault: () => {},
			stopPropagation: () => {},
			isPropagationStopped: () => false,
			isDefaultPrevented: () => false,
			persist: () => {},
		} as React.ChangeEvent<HTMLInputElement>;

		onChange?.(syntheticEvent);
		onClear?.();
	}, [onChange, onClear]);

	React.useEffect(() => {
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, []);

	return (
		<InputGroup className={props.className}>
			<InputGroupAddon align="inline-start">
				<InputGroupText>
					<SearchIcon className="size-4 shrink-0" />
				</InputGroupText>
			</InputGroupAddon>
			<InputGroupInput
				disabled={disabled}
				value={innerValue}
				onChange={handleChange}
				{...props}
				className={undefined}
			/>
			{(alwaysShowClearButton || innerValue) && (
				<InputGroupAddon align="inline-end">
					<InputGroupButton
						type="button"
						variant="ghost"
						size="icon-xs"
						onClick={handleClear}
						{...clearButtonProps}
					>
						<XIcon className="size-3.5 shrink-0" />
					</InputGroupButton>
				</InputGroupAddon>
			)}
		</InputGroup>
	);
};
