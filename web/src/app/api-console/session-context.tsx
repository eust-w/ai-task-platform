"use client";

import { createContext, useContext } from "react";
import type { UserSession } from "./types";

export const SessionContext = createContext<UserSession | null>(null);
export const useSession = () => useContext(SessionContext);
