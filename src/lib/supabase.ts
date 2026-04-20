
// Supabase stub for offline mode
export const supabase = {
	from: () => ({
		select: () => Promise.resolve({ data: [], error: null }),
		insert: () => Promise.resolve({ data: [], error: null }),
		update: () => Promise.resolve({ data: [], error: null }),
		upsert: () => Promise.resolve({ data: [], error: null }),
		delete: () => Promise.resolve({ data: [], error: null }),
		eq: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
		gte: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
		lte: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
		single: () => Promise.resolve({ data: null, error: null }),
		order: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
	}),
	auth: {
		signIn: async () => ({ data: null, error: null }),
		signUp: async () => ({ data: null, error: null }),
		signOut: async () => ({ data: null, error: null }),
		onAuthStateChange: () => ({
			data: {
				subscription: { unsubscribe: () => {} }
			},
			error: null
		}),
		getSession: async () => ({
			data: { session: null },
			error: null
		}),
	},
};