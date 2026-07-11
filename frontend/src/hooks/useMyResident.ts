import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Resident } from "../api/types";

export function useMyResident() {
  const [resident, setResident] = useState<Resident | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<Resident>("/residents/me")
      .then((res) => setResident(res.data))
      .catch(() => setResident(null))
      .finally(() => setLoading(false));
  }, []);

  return { resident, loading };
}
