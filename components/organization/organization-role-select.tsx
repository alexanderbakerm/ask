"use client";

import type * as React from "react";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { organizationMemberRoleLabels } from "@/lib/auth/constants";
import type { OrganizationMemberRole } from "@/types/organization-member-role";

export type OrganizationRoleSelectProps = {
	value: OrganizationMemberRole;
	onSelect: (value: OrganizationMemberRole) => void;
	disabled?: boolean;
};

export function OrganizationRoleSelect({
	value,
	onSelect,
	disabled,
}: OrganizationRoleSelectProps): React.JSX.Element {
	const roleOptions = Object.entries(organizationMemberRoleLabels).map(
		([v, label]) => ({
			value: v,
			label,
		}),
	);

	return (
		<Select disabled={disabled} onValueChange={onSelect} value={value}>
			<SelectTrigger>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{roleOptions.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}
