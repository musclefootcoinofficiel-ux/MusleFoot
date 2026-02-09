import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type SaveGameRequest, type SaveGameResponse } from "@shared/routes";
import { insertGameSaveSchema } from "@shared/schema";
import { z } from "zod";

// Helper to get or create a session ID
const getSessionId = () => {
  let id = localStorage.getItem('musclefoot_session_id');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('musclefoot_session_id', id);
  }
  return id;
};

// Hook to fetch game state
export function useGameSave() {
  const sessionId = getSessionId();
  return useQuery({
    queryKey: [api.game.get.path, sessionId],
    queryFn: async () => {
      // Build the URL with the parameter manually since we need to inject the sessionId
      const url = api.game.get.path.replace(':sessionId', sessionId);
      const res = await fetch(url, { credentials: "include" });
      
      if (res.status === 404) return null; // New user
      if (!res.ok) throw new Error('Failed to fetch game save');
      
      return api.game.get.responses[200].parse(await res.json());
    },
    // Don't refetch too aggressively for a clicker game, we rely on local state mostly
    staleTime: 1000 * 60, 
  });
}

// Hook to save game state
export function useSaveGame() {
  const queryClient = useQueryClient();
  const sessionId = getSessionId();

  return useMutation({
    mutationFn: async (data: Omit<SaveGameRequest, 'sessionId'>) => {
      const payload: SaveGameRequest = { ...data, sessionId };
      // Validate locally before sending
      const validated = api.game.save.input.parse(payload);
      
      const res = await fetch(api.game.save.path, {
        method: api.game.save.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validated),
        credentials: "include",
      });

      if (!res.ok) {
        if (res.status === 400) {
           const error = api.game.save.responses[400].parse(await res.json());
           throw new Error(error.message);
        }
        throw new Error('Failed to save game');
      }

      // Handle 200 (update) or 201 (create)
      const successSchema = res.status === 201 
        ? api.game.save.responses[201] 
        : api.game.save.responses[200];
      
      return successSchema.parse(await res.json());
    },
    onSuccess: (savedData) => {
      // Update the get query cache with the new data
      queryClient.setQueryData([api.game.get.path, sessionId], savedData);
    },
  });
}
