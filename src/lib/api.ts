import Constants from "expo-constants";
import type { Credentials } from "./types";

export const API_URL: string = Constants.expoConfig?.extra?.apiUrl ?? "";
export const EAS_PROJECT_ID: string | undefined = Constants.expoConfig?.extra?.eas?.projectId;
// False in the "development-basic" iPhone build made before Apple approves Family Controls.
export const SCREEN_TIME_BUILD: boolean = Constants.expoConfig?.extra?.screenTime !== false;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

let credentials: Credentials | null = null;

export function setCredentials(value: Credentials) {
  credentials = value;
}

export function getCredentials() {
  return credentials;
}

// Every call is a POST with a JSON body; the device secret identifies this phone (there are no logins).
export async function call<T = { ok: true }>(route: string, body: object = {}): Promise<T> {
  if (!API_URL || API_URL.includes("YOUR-PROJECT-REF")) {
    throw new ApiError("BeSeen isn't connected to a server yet. Set API_URL in app.config.ts (see docs/SETUP.md).", 0);
  }
  let response: Response;
  try {
    response = await fetch(`${API_URL}/${route}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(credentials ? { "x-beseen-device": `${credentials.deviceId}.${credentials.deviceSecret}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError("Can't reach BeSeen. Check your internet connection.", 0);
  }
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(data.error ?? `Something went wrong (${response.status}).`, response.status);
  return data as T;
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong.";
}
