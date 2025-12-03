import { QueryClient, QueryFunction } from "@tanstack/react-query";

//error handling for API requests
async function throwIfResNotOk(res: Response) {
    if (!res.ok) {
        const text = (await res.text()) || res.statusText;
        throw new Error(`${res.status}: ${text}`);
    }
}

// API request helper function
export async function apiRequest(
    method: string, // GET, POST, PUT, DELETE, etc.
    url: string, // /api/preferences
    data?: unknown | undefined, // body data for POST, PUT, etc.
): Promise<Response> {
    const res = await fetch(url, {
        method,
        headers: data ? { "Content-Type": "application/json" } : {}, // If sending data → set JSON header
        body: data ? JSON.stringify(data) : undefined, // If sending data → stringify body
        credentials: "include",
    });

    await throwIfResNotOk(res);
    return res;
}

//reusable fetch function for API requests
type UnauthorizedBehavior = "returnNull" | "throw";

export const getQueryFn: <T>(options: {
    on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
    ({ on401: unauthorizedBehavior }) =>
        async ({ queryKey }) => {
            const res = await fetch(queryKey[0] as string, {
                credentials: "include",
            });

            if (unauthorizedBehavior === "returnNull" && res.status === 401) {
                return null;
            }

            await throwIfResNotOk(res);
            return await res.json();
        };

//create react query client for the whole app
export const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            queryFn: getQueryFn({ on401: "throw" }),
            refetchInterval: false,
            refetchOnWindowFocus: false,
            staleTime: Infinity,
            retry: false,
        },
        mutations: {
            retry: false,
        },
    },
});