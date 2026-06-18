"use client";

import * as React from "react";
import type { Session } from "@/types/session";

type SessionContextValue = {
	session: Session["session"] | null;
	user: Session["user"] | null;
	loaded: boolean;
	reloadSession: () => Promise<void>;
};

const defaultContextValue: SessionContextValue = {
	session: null,
	user: null,
	loaded: false,
	reloadSession: async () => {},
};

export const SessionContext =
	React.createContext<SessionContextValue>(defaultContextValue);

export function useSession() {
	return React.useContext(SessionContext);
}
